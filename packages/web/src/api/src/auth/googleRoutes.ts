import { Router, type Request, type Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { google } from 'googleapis';
import type { PrismaClient } from '@prisma/client';
import { linkGoogleIdentity, googleSignInConfigured, type GoogleEnv } from './googleLink.js';
import { toAuthUser, type AuthUser, type SessionUserRow } from './appUsers.js';
import { setRememberMeCookie } from './rememberMe.js';

/**
 * "Pokračovat přes Google" — the OAuth 2.0 authorisation-code flow, server side.
 *
 * Deliberately not a Passport strategy: Passport is only used here to serialise the
 * session, and `googleapis` (already a dependency) provides the pieces that matter —
 * the authorisation URL, the code exchange with PKCE, and `verifyIdToken`, which
 * checks Google's signature, expiry and `audience`. Hand-rolling the token
 * verification would be the one genuinely dangerous part of this feature.
 *
 * The router is a factory so the HTTP layer can be tested with supertest without
 * booting `server.ts` (which starts Prisma, Apollo and Next).
 *
 * What it never does: mint a session for an identity `linkGoogleIdentity` refused,
 * or reach into `role` / `is_author`.
 */

const SCOPE = ['openid', 'email', 'profile'];
const STATE_COOKIE_KEY = 'googleOAuth';

interface PendingFlow {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

export interface GoogleRouterDeps {
  prisma: PrismaClient;
  /** One row by id, with `csld_image`, ready for `toAuthUser`. */
  loadUser: (id: number) => Promise<SessionUserRow | null>;
  /** `req.login` wrapped in a promise (kept injectable so tests need no Passport). */
  login: (req: Request, user: AuthUser) => Promise<void>;
  env?: GoogleEnv;
}

/** Only same-origin absolute paths: `//evil.example` is a protocol-relative URL. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * express-session augments `Request` with `.session`, but the augmentation is not
 * visible to TypeScript in this ESM/ts-jest setup — go through a narrow cast, and
 * fail loudly rather than silently dropping the flow when the middleware is absent.
 */
function sessionOf(req: Request): Record<string, unknown> {
  const session = (req as unknown as { session?: Record<string, unknown> }).session;
  if (!session) throw new Error('express-session middleware is not mounted');
  return session;
}

/** Constant-time compare that cannot throw on length mismatch. */
function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * The redirect URI Google must have registered. `GOOGLE_REDIRECT_URI` wins because
 * the app sits behind a TLS-terminating proxy (a derived host would need
 * `trust proxy` to be right); the fallback covers local runs.
 */
function resolveRedirectUri(req: Request, env: GoogleEnv): string {
  const configured = env.GOOGLE_REDIRECT_URI;
  if (configured) return configured;
  const forwarded = req.get('x-forwarded-proto');
  const proto = forwarded?.split(',')[0]?.trim() || req.protocol;
  return `${proto}://${req.get('host')}/auth/google/callback`;
}

export function createGoogleRouter(deps: GoogleRouterDeps): Router {
  const env: GoogleEnv = deps.env ?? (process.env as GoogleEnv);
  const router = Router();

  const configured = () => googleSignInConfigured(env);

  const client = () =>
    new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);

  const fail = (res: Response, reason: string) => res.redirect(`/signIn?error=${reason}`);

  /** Tells the sign-in page whether to offer the button at all. */
  router.get('/status', (_req, res) => {
    res.json({ enabled: configured() });
  });

  router.get('/', (req, res) => {
    if (!configured()) return fail(res, 'google_unavailable');

    const state = base64url(randomBytes(32));
    const codeVerifier = base64url(randomBytes(32));
    const flow: PendingFlow = {
      state,
      codeVerifier,
      returnTo: safeReturnTo(req.query.returnTo),
    };
    sessionOf(req)[STATE_COOKIE_KEY] = flow;

    // The authorisation URL is built here rather than by the client library,
    // because googleapis types `code_challenge_method` as an enum while the wire
    // value is the documented string. The token exchange and the ID-token
    // verification below still go through `googleapis` — those are the parts that
    // must not be hand-rolled.
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID as string,
      redirect_uri: resolveRedirectUri(req, env),
      response_type: 'code',
      scope: SCOPE.join(' '),
      state,
      code_challenge: base64url(createHash('sha256').update(codeVerifier).digest()),
      code_challenge_method: 'S256',
      access_type: 'online',
      prompt: 'select_account',
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.redirect(url);
  });

  router.get('/callback', async (req, res) => {
    const session = sessionOf(req);
    const flow = session[STATE_COOKIE_KEY] as PendingFlow | undefined;
    // One-shot: a replayed callback must not find the flow still there.
    delete session[STATE_COOKIE_KEY];

    if (req.query.error) return fail(res, 'google_cancelled');
    if (!flow) return fail(res, 'google_state');
    if (typeof req.query.state !== 'string' || !sameState(req.query.state, flow.state)) {
      return fail(res, 'google_state');
    }
    if (typeof req.query.code !== 'string' || !req.query.code) return fail(res, 'google_failed');
    if (!configured()) return fail(res, 'google_unavailable');

    try {
      const oauth = client();
      const { tokens } = await oauth.getToken({
        code: req.query.code,
        codeVerifier: flow.codeVerifier,
        redirect_uri: resolveRedirectUri(req, env),
      });
      if (!tokens.id_token) throw new Error('no id_token in the token response');

      const ticket = await oauth.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('id_token has no subject');

      const outcome = await linkGoogleIdentity(deps.prisma, {
        sub: payload.sub,
        email: payload.email ?? '',
        emailVerified: payload.email_verified === true,
        name: payload.name ?? null,
      });

      if (outcome.kind === 'unverified') return fail(res, 'google_unverified');
      if (outcome.kind === 'ambiguous') {
        console.warn(
          `[google] refused to link sub ${payload.sub}: ` +
            `${outcome.userIds.length} accounts share one address (ids ${outcome.userIds.join(', ')})`,
        );
        return fail(res, 'google_ambiguous');
      }
      if (outcome.kind === 'conflict') {
        console.warn(`[google] refused to link sub ${payload.sub}: account ${outcome.userId} has another Google identity`);
        return fail(res, 'google_conflict');
      }

      const row = await deps.loadUser(outcome.userId);
      if (!row) throw new Error(`linked user ${outcome.userId} disappeared`);

      const user = toAuthUser(row);
      await deps.login(req, user);
      setRememberMeCookie(res, user.id);

      if (outcome.kind === 'registered') {
        console.warn(`[google] registered account ${user.id} from sub ${payload.sub}`);
      } else if (outcome.how === 'email') {
        console.warn(`[google] signed in account ${user.id} via auto-link from sub ${payload.sub}`);
      }

      return res.redirect(flow.returnTo);
    } catch (error) {
      console.error('[google] callback failed:', error);
      return fail(res, 'google_failed');
    }
  });

  return router;
}
