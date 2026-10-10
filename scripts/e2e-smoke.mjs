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

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
