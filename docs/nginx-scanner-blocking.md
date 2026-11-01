# Blocking scanner/bot probes at nginx + robots.txt (audit follow-up 2026-11-01)

Follow-up to the site-usage audit (window 18 Oct – 1 Nov 2026, nginx access log +
production DB):

- 62 162 of 99 078 attributed requests (63 %) were crawlers. PetalBot alone
  20 927 requests, AhrefsBot 13 728 (5 597 of them on 31 Oct — a storm), and
  **neither was in robots.txt** (only BLEXBot was).
- 51 470 scanner probes (`/admin*`, `/.env`, `/.git/config`, `/phpinfo.php`,
  `/wp-*`, …) came from 1 492 IPs wearing ordinary browser User-Agents — they do
  not respect robots.txt, so they have to be cut at the edge.
- The app log showed `URIError: Failed to decode param '/%c0'` — an undecodable
  path crashed param decoding instead of answering 400.

## What changed where

| Layer | Change | Where |
|---|---|---|
| robots.txt | `AhrefsBot`, `PetalBot`, `PetalSearch` added to the per-agent Disallow list (sitemap line kept); rules extracted to a unit-tested module | `packages/web/src/utils/robotsTxt.ts`, wired in `packages/web/server.ts` |
| app (this repo) | express middleware answers **400** for scanner probe paths and for undecodable/invalid percent-encoding (`/%c0` and friends) before any route runs, so probe input can never reach Next's param decoding and throw `URIError` | `packages/web/src/utils/scannerGuard.ts`, mounted in `packages/web/server.ts` right after `cookieParser()` |
| nginx (on the box) | location blocks below return **444** for the same probe shapes and **400** for invalid percent-encoding | vhost config on `193.150.13.68`, snippet below — **this file is the documentation, the vhost itself is not in git** |

## nginx vhost snippet (larpovadatabaze.cz)

Apply inside the `server { … }` block of the `larpovadatabaze.cz` vhost on
`193.150.13.68` (the box has no passwordless sudo, so the user applies it with
`sudo`; verify with `sudo nginx -t && sudo systemctl reload nginx`).
`444` = close the connection without answering (nginx logs it as 444, no
response bytes are sent — cheapest possible answer for a probe).

```nginx
# ── Scanner/bot probe blocking (site-usage audit 2026-11-01) ──────────────
# 51 470 probes in 14 days from 1 492 IPs with browser UAs (/.env, /.git/config,
# /wp-*, /phpinfo.php, /admin/.env, ...). Mirrors packages/web/src/utils/scannerGuard.ts
# (the app answers 400 for the same shapes as a fallback); keep the two in sync.
# NOTE: CSLD has a REAL /admin section (pages/admin/*) — only obvious probe
# shapes are blocked, never /admin itself.

# Malformed percent-encoding (overlong UTF-8 like %c0/%c1, stray continuation
# bytes %80-%bf, %fe/%ff): answer 400 instead of proxying a path the app's
# decoder would crash on (URIError: Failed to decode param '/%c0').
if ($request_uri ~* "%((c[01])|([89ab][0-9a-f])|(fe)|(ff))") {
    return 400;
}

# Scanner probe shapes: drop the connection (444 = no response at all).
location ~* ^/(\.env|\.git|\.svn|\.hg|wp-admin|wp-content|wp-includes|wp-login|wp-config|wordpress|xmlrpc|phpmyadmin|pma/|administrator|admin/(\.env|config|login|php)|php|cgi-bin|vendor|config|backup|shell|boaform) {
    return 444;
}
location ~* (phpinfo|info|test|shell|cmd|eval)\.php$ {
    return 444;
}
```

Caveats:

- `if ($request_uri …)` runs against the **raw** URI, so `%c0` is matched before
  any decoding — exactly the case that used to crash the app.
- The `location ~*` blocks match the raw URI too; encoded variants such as
  `/%2egit/config` are normalized by nginx before location matching when
  `merge_slashes`/decoding applies, and the app-side middleware decodes and
  re-checks as the second net (it answers 400).
- Do NOT block `^/admin` — the app serves `/admin`, `/admin/labels`,
  `/admin/stats`, `/admin/users`, `/admin/selfRated` there.

## Verify after applying

```bash
# blocked at the edge → 444 (curl reports "Empty reply from server")
curl -s -o /dev/null -w '%{http_code}\n' https://larpovadatabaze.cz/.env
curl -s -o /dev/null -w '%{http_code}\n' https://larpovadatabaze.cz/.git/config
curl -s -o /dev/null -w '%{http_code}\n' https://larpovadatabaze.cz/wp-login.php
curl -s -o /dev/null -w '%{http_code}\n' https://larpovadatabaze.cz/phpinfo.php
curl -s -o /dev/null -w '%{http_code}\n' https://larpovadatabaze.cz/admin/.env
# undecodable → 400
curl -s -o /dev/null -w '%{http_code}\n' 'https://larpovadatabaze.cz/%c0'
# real routes unaffected
curl -s -o /dev/null -w '%{http_code}\n' https://larpovadatabaze.cz/admin
curl -s -o /dev/null -w '%{http_code}\n' https://larpovadatabaze.cz/larp/ve-znameni-zla/cs/534
curl -s https://larpovadatabaze.cz/robots.txt | grep -E 'AhrefsBot|PetalBot|Sitemap'
```

(`444` shows as curl error 52 "Empty reply from server"; the `-w '%{http_code}'`
form prints `000`. Either way the request is dropped, and the access log records
`444`.)

## robots.txt (app-side, deployed with this PR)

`packages/web/src/utils/robotsTxt.ts` renders `/robots.txt`: blanket
`Disallow: /` on non-production hosts; on `larpovadatabaze.cz` an
`Allow: /` with `Disallow: /admin` + `/graphql` for everyone, a per-agent
`Disallow: /` for the blocked crawler list (now including **AhrefsBot**,
**PetalBot**, **PetalSearch**, plus the previously listed AI/SEO scrapers), and
the `Sitemap:` line.
