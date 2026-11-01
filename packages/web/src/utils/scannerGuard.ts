/**
 * Scanner / bot probe guard, shared by the app and the nginx vhost docs.
 *
 * The 2026-10-18 → 2026-11-01 access-log audit counted 51 470 scanner probes
 * (`/.env`, `/.git/config`, `/wp-*`, `/phpinfo.php`, `/admin/.env`, …) from
 * 1 492 IPs wearing ordinary browser User-Agents — they do not respect
 * robots.txt, so they are cut at the edge: nginx returns 444 for the path
 * shapes below (see docs/nginx-scanner-blocking.md), and this middleware is
 * the app-side net for anything that slips past it (or for setups where nginx
 * is not in front). Undecodable percent-sequences (`/%c0`) are malformed
 * requests: they get a 400, never a thrown URIError.
 *
 * CSLD has a real `/admin` section (pages/admin/*), so the block list targets
 * obvious probe shapes only — `/admin/login`, `/admin/.env`, `/administrator/*`
 * — and never the app's own `/admin`, `/admin/labels`, `/admin/stats`, …
 */

/** Raw request path (no query string), decoded when decodable, else null. */
export type DecodedPath =
  | { ok: true; path: string }
  | { ok: false; raw: string };

/** Decode a raw URL path; `/%c0`-style undecodable input yields ok:false. */
export const decodeRequestPath = (rawPath: string): DecodedPath => {
  try {
    return { ok: true, path: decodeURIComponent(rawPath) };
  } catch {
    return { ok: false, raw: rawPath };
  }
};

/**
 * Percent-encoded octets that are invalid in a UTF-8 URL path (overlong
 * encodings such as %c0/%c1, stray continuation bytes %80-%bf, %fe/%ff).
 * nginx's own decode rejects these too; matching them keeps the 400 answer
 * consistent between the edge and the app.
 */
const INVALID_PERCENT_SEQUENCE = /%(?:c[01]|[89ab][0-9a-f]|fe|ff)/i;

/** Lower-cased path prefixes that are always scanner probes, never app routes. */
const BLOCKED_PATH_PREFIXES = [
  '/.env',
  '/.git',
  '/.svn',
  '/.hg',
  '/wp-admin',
  '/wp-content',
  '/wp-includes',
  '/wp-login',
  '/wp-config',
  '/wordpress',
  '/xmlrpc',
  '/phpmyadmin',
  '/pma',
  '/administrator',
  '/admin/.env',
  '/admin/config',
  '/admin/login',
  '/admin/php',
  '/php',
  '/cgi-bin',
  '/vendor',
  '/config',
  '/backup',
  '/shell',
  '/boaform',
];

/** Path suffixes that mark a probe regardless of prefix (`/x/phpinfo.php`). */
const BLOCKED_PATH_SUFFIXES = [
  '/phpinfo.php',
  '/info.php',
  '/test.php',
  '/shell.php',
  '/cmd.php',
  '/eval.php',
];

/**
 * Does this request path look like a scanner probe? Operates on the DECODED,
 * lower-cased path so encoded variants (`/%2e%2e/`, `/wp%2dadmin`) match too.
 */
export const isScannerProbePath = (decodedPath: string): boolean => {
  const path = decodedPath.toLowerCase();
  if (BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) return true;
  return BLOCKED_PATH_SUFFIXES.some((suffix) => path.endsWith(suffix));
};

export type ScannerVerdict =
  | { action: 'pass' }
  | { action: 'reject'; status: 400 | 444; reason: string };

/**
 * Classify a raw request path the way the edge does:
 * - undecodable percent-sequences or an invalid one → 400 (malformed request,
 *   the same class as the `/%c0` URIError this replaces);
 * - a known scanner shape → 444 (drop the connection; logged as 444 in nginx);
 * - anything else → pass through to the app.
 */
export const classifyRequestPath = (rawPath: string): ScannerVerdict => {
  if (INVALID_PERCENT_SEQUENCE.test(rawPath)) {
    return { action: 'reject', status: 400, reason: 'invalid percent-encoding' };
  }
  const decoded = decodeRequestPath(rawPath);
  if (!decoded.ok) {
    return { action: 'reject', status: 400, reason: 'undecodable path' };
  }
  if (isScannerProbePath(decoded.path)) {
    return { action: 'reject', status: 444, reason: 'scanner probe path' };
  }
  return { action: 'pass' };
};

interface MinimalRequest {
  url?: string;
  originalUrl?: string;
  method?: string;
}

interface MinimalResponse {
  status: (code: number) => MinimalResponse;
  end: (body?: string) => unknown;
}

/**
 * Express middleware: rejects scanner probes with 444 and malformed
 * percent-encoded paths with 400 BEFORE any route (including the Next.js
 * catch-all) runs, so probe input can never reach param decoding and throw
 * URIError. Mount it right after cookieParser/session, before every route.
 */
export const scannerGuardMiddleware = () => {
  return (req: MinimalRequest, res: MinimalResponse, next: () => void): void => {
    const rawPath = (req.originalUrl ?? req.url ?? '').split('?')[0] || '/';
    const verdict = classifyRequestPath(rawPath);
    if (verdict.action === 'pass') {
      next();
      return;
    }
    // 444 is nginx's "close without answering"; plain Node cannot send it, so
    // the app answers 400 for both classes (the edge still sends 444 and never
    // proxies the request). 400 keeps clients and logs honest: the request was
    // malformed or unwanted, not missing.
    res.status(400).end();
  };
};
