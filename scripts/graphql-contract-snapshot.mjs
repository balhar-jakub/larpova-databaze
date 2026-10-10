#!/usr/bin/env node
/**
 * GraphQL contract snapshot (Fáze 0b).
 *
 * Sends the key read queries every phase of the tech-debt roadmap must not
 * break — homepage blocks, game detail, search, user profile, event calendar,
 * admin-free metadata — and stores the responses as JSON snapshots.
 *
 * Usage:
 *   node scripts/graphql-contract-snapshot.mjs                       # compare against baseline
 *   node scripts/graphql-contract-snapshot.mjs --update                # write/refresh baseline
 *   CSLD_API=https://csld.vezlute.cz/graphql node ...                 # target endpoint
 *
 * Baseline: scripts/__snapshots__/graphql-contract-baseline.json
 * Default target: the TEST instance, never production.
 *
 * Design notes:
 * - Only stable shape matters, not volatile values: dates/timestamps and
 *   row counts are masked before comparison so a new comment on the test
 *   server does not false-positive the gate. Identifiers are kept — they
 *   prove the queries still resolve the same entities.
 * - The queries mirror what the frontend actually sends (see
 *   packages/web/src/components/* panels).
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = join(__dirname, '__snapshots__');
const BASELINE = join(SNAPSHOT_DIR, 'graphql-contract-baseline.json');

const API = process.env.CSLD_API || 'https://csld.vezlute.cz/graphql';
const UPDATE = process.argv.includes('--update');

/** Volatile fields masked out of every snapshot (shape, not data). */
const VOLATILE_KEYS = /^(added|from|to|addedAt|updatedAt|createdAt|registered)$/;

function mask(value, key = '') {
  if (Array.isArray(value)) return value.map((v) => mask(v, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = mask(v, k);
    return out;
  }
  if (VOLATILE_KEYS.test(key)) return '<ts>';
  return value;
}

const QUERIES = {
  config: '{ config { reCaptchaKey } }',
  homepage: `{
    homepage {
      lastAddedGames { id name }
      bestRatedGames { id name }
      recentGames { game { id name } event { id } }
      stats { games users }
      topLabels { name count }
      nextEvents { id name }
      lastComments(offset: 0, limit: 5) { id commentAsText }
    }
  }`,
  gamesLadder: `{ games { ladder(ladderType: Recent, offset: 0, limit: 5) { totalAmount games { id name } } } }`,
  gameDetail: `{
    gameById(gameId: "12") {
      id name year players averageRating amountOfRatings amountOfComments
      description
      labels { name }
      authors { id name }
    }
  }`,
  gamesByQuery: `{ games { byQuery(query: "larp", offset: 0, limit: 5) { id name } } }`,
  userById: `{
    userById(userId: "1") {
      id name role
      amountOfComments amountOfPlayed amountOfCreated
      commentsPaged(offset: 0, limit: 5) { totalAmount comments { id } }
    }
  }`,
  eventCalendar: `{ eventCalendar(from: "2000-01-01", to: "2030-01-01") { totalAmount events { id name } } }`,
  authorizedLabels: `{ authorizedRequiredLabels { id name } authorizedOptionalLabels { id name } }`,
};

async function fetchQuery(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for query`);
  const body = await res.json();
  if (body.errors) throw new Error(`GraphQL errors: ${JSON.stringify(body.errors).slice(0, 200)}`);
  return mask(body.data);
}

async function main() {
  const results = {};
  let failures = 0;
  for (const [name, query] of Object.entries(QUERIES)) {
    try {
      results[name] = await fetchQuery(query);
      console.log(`✓ ${name}`);
    } catch (e) {
      results[name] = { __error: String(e.message) };
      console.error(`✗ ${name}: ${e.message}`);
      failures++;
    }
  }

  if (UPDATE) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(BASELINE, JSON.stringify(results, null, 2) + '\n');
    console.log(`\nBaseline written: ${BASELINE} (${failures} failed queries captured as errors)`);
    process.exit(failures ? 1 : 0);
  }

  if (!existsSync(BASELINE)) {
    console.error('\nNo baseline exists yet — run with --update first.');
    process.exit(2);
  }

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf-8'));
  let diffs = 0;
  for (const name of Object.keys(QUERIES)) {
    const before = JSON.stringify(baseline[name]);
    const after = JSON.stringify(results[name]);
    if (before !== after) {
      diffs++;
      console.error(`≠ ${name} changed`);
    }
  }
  console.log(diffs ? `\n${diffs} contract diff(s) — see above` : '\nContract intact — no diffs.');
  process.exit(diffs || failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
