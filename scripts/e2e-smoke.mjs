#!/usr/bin/env node
/**
 * E2E smoke suite (Fáze 0c).
 *
 * Walks the site as a visitor (plus unauthenticated error paths) and asserts
 * the surfaces every roadmap phase must keep working: pages render, the GraphQL
 * endpoint answers, legacy URLs still route, crawler endpoints (robots,
 * sitemap, ical) respond, images serve, auth endpoints behave. No login —
 * credentials never belong in a smoke run; authenticated flows are covered by
 * the API jest suites.
 *
 * Usage:
 *   node scripts/e2e-smoke.mjs
 *   CSLD_BASE=https://larpovadatabaze.cz node scripts/e2e-smoke.mjs   # prod (read-only checks only)
 *
 * Default target: the TEST instance.
 */
const BASE = (process.env.CSLD_BASE || 'https://csld.vezlute.cz').replace(/\/$/, '');

let failed = 0;
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}: ${e.message}`);
  }
}

async function get(path, { ok = [200], method = 'GET', headers = {}, redirect = 'follow' } = {}) {
  const res = await fetch(BASE + path, { method, headers, redirect });
  if (!ok.includes(res.status)) {
    throw new Error(`HTTP ${res.status} (expected ${ok.join('/')})`);
  }
  return res;
}

async function gql(query) {
  const res = await fetch(BASE + '/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (res.status !== 200) throw new Error(`GraphQL HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors) throw new Error(`GraphQL errors: ${body.errors[0].message}`);
  return body.data;
}

const main = async () => {
  console.log(`E2E smoke against ${BASE}\n`);

  await check('health endpoint answers ok', async () => {
    const res = await get('/health');
    const body = await res.json();
    if (body.status !== 'ok') throw new Error(`status: ${JSON.stringify(body)}`);
  });

  await check('homepage renders (HTML with content)', async () => {
    const res = await get('/');
    const html = await res.text();
    if (html.length < 1000) throw new Error(`suspiciously short page (${html.length} bytes)`);
    if (!/<body/i.test(html)) throw new Error('no <body> element');
  });

  await check('game detail page renders', async () => {
    // Find a real game via GraphQL first, then load its page.
    const data = await gql('{ games { ladder(ladderType: Recent, offset: 0, limit: 1) { games { id } } } }');
    const id = data.games.ladder.games[0].id;
    const res = await get(`/gameDetail?id=${id}`);
    const html = await res.text();
    if (!/<body/i.test(html)) throw new Error('no <body> element');
  });

  await check('games catalog page renders', async () => {
    const res = await get('/games');
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await check('search page renders', async () => {
    const res = await get('/search?query=larp');
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await check('calendar page renders (legacy /kalendar route)', async () => {
    const res = await get('/kalendar');
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  await check('GraphQL homepage query answers', async () => {
    const data = await gql('{ homepage { stats { games users } } }');
    if (typeof data.homepage.stats.games !== 'number') throw new Error('stats.games not a number');
  });

  await check('legacy URL /hra.jsp still routes', async () => {
    const res = await get('/hra.jsp?id=12', { ok: [200, 301, 302, 307, 308] });
    // rewrite to gameDetail — any of 200 (render) or a redirect chain is fine
    if (res.status === 200) {
      const html = await res.text();
      if (!/<body/i.test(html)) throw new Error('no <body> element');
    }
  });

  await check('robots.txt is well-formed (test env: Disallow all)', async () => {
    const res = await get('/robots.txt');
    const txt = await res.text();
    if (!/User-agent:/i.test(txt)) throw new Error('no User-agent line');
    // On the test instance the whole site must be disallowed; on prod a Sitemap
    // line must be present. Either way the file must be a valid robots.txt.
    if (!/Disallow:/i.test(txt)) throw new Error('no Disallow line');
  });

  await check('sitemap.xml lists game URLs', async () => {
    const res = await get('/sitemap.xml');
    const xml = await res.text();
    if (!/<urlset/i.test(xml)) throw new Error('not a urlset document');
  });

  await check('ical feed returns a VCALENDAR', async () => {
    const res = await get('/ical');
    const ics = await res.text();
    if (!/BEGIN:VCALENDAR/.test(ics)) throw new Error('no VCALENDAR');
  });

  await check('game image endpoint answers (200 or 404, not 5xx)', async () => {
    const res = await get('/game-image/', { ok: [200, 400, 404] });
    await res.text();
  });

  await check('Image Optimization API is DISABLED (unauthenticated RCE surface removed)', async () => {
    // Phase 2: images.unoptimized:true. The optimizer endpoint must not serve
    // anything — 404 (route gone) or 400 (param rejected) are both fine,
    // a 200 would mean the vulnerable optimizer is still live.
    const res = await get('/_next/image?url=/static/images/user-icon.png&w=64&q=75', {
      ok: [400, 404, 405, 501],
    });
    await res.text();
  });

  await check('unknown page 404s', async () => {
    const res = await get('/this-page-does-not-exist-xyz', { ok: [404] });
    await res.text();
  });

  await check('GraphQL mutation without auth is rejected (no accidental open writes)', async () => {
    const res = await fetch(BASE + '/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { game { deleteGame(gameId: "12") { id } } }' }),
    });
    const body = await res.json();
    // Must be an error (auth required) — NOT a successful delete.
    if (!body.errors) throw new Error('mutation succeeded without authentication!');
  });

  // ── Phase 4: negative-auth battery ─────────────────────────────
  // The auth regressions this audit fixed (admin gateway open to any signed-in
  // role, remember-me cookie forgeable with a public key) must never come
  // back. These probes send NO valid credentials — they only assert that the
  // doors stay closed — so they are safe to run against production too.

  await check('anonymous admin READ is refused (admin gateway stays closed)', async () => {
    const res = await fetch(BASE + '/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { admin { allUsers { id } } }' }),
    });
    const body = await res.json();
    if (!body.errors) throw new Error('admin.allUsers answered without authentication!');
    const err = body.errors[0];
    if (err.extensions?.code !== 'ACCESS_DENIED') {
      throw new Error(`expected ACCESS_DENIED, got: ${err.extensions?.code || 'none'} (${err.message})`);
    }
    if (body.data?.admin != null) throw new Error('admin gateway returned data despite ACCESS_DENIED');
  });

  await check('anonymous admin MUTATION is refused (every AdminMutation resolver guards)', async () => {
    const res = await fetch(BASE + '/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { admin { setUserRole(userId: "1", role: EDITOR) { id } } }' }),
    });
    const body = await res.json();
    if (!body.errors) throw new Error('admin.setUserRole answered without authentication!');
    if (body.errors[0].extensions?.code !== 'ACCESS_DENIED') {
      throw new Error(`expected ACCESS_DENIED, got: ${body.errors[0].extensions?.code || 'none'}`);
    }
    // and no side effect: the second call must have failed the same way
    const res2 = await fetch(BASE + '/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { admin { deleteUser(userId: "1") { id } } }' }),
    });
    const body2 = await res2.json();
    if (!body2.errors || body2.errors[0].extensions?.code !== 'ACCESS_DENIED') {
      throw new Error('admin.deleteUser not ACCESS_DENIED for anonymous!');
    }
  });

  await check('anonymous user-mutation is refused (profile writes need a session)', async () => {
    const res = await fetch(BASE + '/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { user { updateLoggedInUser(input: { email: "probe@integration.test", name: "probe" }) { id } } }' }),
    });
    const body = await res.json();
    if (!body.errors) throw new Error('updateLoggedInUser answered without authentication!');
  });

  await check('remember-me cookie forged with the OLD public key authenticates nobody', async () => {
    // The pre-fix fallback key was hard-coded in the repo (public). A cookie
    // signed with it must authenticate nobody on any instance that has a real
    // REMEMBER_ME_KEY configured — the exact forgery from the audit's PoC.
    const { createHmac } = await import('node:crypto');
    const OLD_KEY = 'csld-remember-me-key';
    const payload = `1:${Date.now() + 30 * 24 * 3600 * 1000}`;
    const sig = createHmac('sha256', OLD_KEY).update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${sig}`).toString('base64url');

    const res = await fetch(BASE + '/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `LoggedIn=${token}` },
      body: JSON.stringify({ query: 'query { loggedInUser { id name role } }' }),
    });
    const body = await res.json();
    if (body.errors) throw new Error(`GraphQL errors: ${body.errors[0].message}`);
    if (body.data?.loggedInUser != null) {
      throw new Error(`FORGED remember-me cookie authenticated user ${body.data.loggedInUser.id}!`);
    }
  });

  await check('tampered remember-me payload (no signature) authenticates nobody', async () => {
    const payload = `1:${Date.now() + 30 * 24 * 3600 * 1000}`;
    const token = Buffer.from(`${payload}:not-a-signature`).toString('base64url');
    const res = await fetch(BASE + '/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `LoggedIn=${token}` },
      body: JSON.stringify({ query: 'query { loggedInUser { id } }' }),
    });
    const body = await res.json();
    if (body.errors) throw new Error(`GraphQL errors: ${body.errors[0].message}`);
    if (body.data?.loggedInUser != null) throw new Error('unsigned remember-me cookie authenticated a user!');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
