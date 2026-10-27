import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';

/**
 * The nightly-batch cluster (similarityEngine + tasks.ts) consists of GLOBAL
 * batch jobs: they walk every game in whatever database they are pointed at
 * and rewrite similar_games / amount_of_ratings. Running them against the
 * shared test database rewrites other suites' fixtures mid-run (ordering
 * assertions break, FK cascades fail) — so this suite gets its own private
 * throwaway database, created in beforeAll and dropped in afterAll.
 *
 * Covered here (this cluster was completely untested — it only runs from the
 * 02:00 cron in index.ts):
 * - similarityEngine: the 5-factor Java-parity similarity (labels 40% with
 *   the required-labels-double rule, rating 20%, authors 20%, year 10%,
 *   players 10%), the top-9 contract, deleted-game exclusion
 * - tasks.ts: the amount_of_ratings drift recalculation, and the flag-gated
 *   nightly orchestrator (INTEGRATE_CALENDAR / INTEGRATE_ARTICLES unset)
 * - passport.ts: session serialization round-trip (main test DB via context
 *   — no batch jobs involved, just a fixture account)
 *
 * The three external importers (larp.cz, larpy.cz) are network code and
 * deliberately out of scope — they need an HTTP-mock harness first.
 */

const stamp = Date.now();
const DB_NAME = `csld_nightly_${stamp}`;
const PG_PORT = process.env.PG_PORT ?? '5433';
const PG_USER = process.env.PG_USER ?? 'csld';
const PG_PASS = process.env.PG_PASS ?? 'csld';
const PG_HOST = process.env.PG_HOST ?? 'localhost';
const SANDBOX_URL = `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${DB_NAME}?sslmode=disable`;

let db: PrismaClient;
let userId: number;
let labelA: number;
let labelB: number;
let requiredLabel: number;

async function makeGame(opts: {
  name: string;
  totalRating?: number | null;
  year?: number;
  players?: number;
  labels?: number[];
  authors?: number[];
}) {
  const game = await db.csld_game.create({
    data: {
      name: opts.name,
      description: 'sim fixture',
      added_by: userId,
      deleted: false,
      lang: 'cs',
      total_rating: opts.totalRating ?? null,
      year: opts.year ?? null,
      players: opts.players ?? null,
    },
  });
  for (const id_label of opts.labels ?? []) {
    await db.csld_game_has_label.create({ data: { id_game: game.id, id_label } });
  }
  for (const id_user of opts.authors ?? []) {
    await db.csld_game_has_author.create({ data: { id_game: game.id, id_user } });
  }
  return game;
}

beforeAll(async () => {
  // ── private throwaway database ──────────────────────
  const { Client } = await import('pg');
  const admin = new Client({
    host: PG_HOST, port: Number(PG_PORT), user: PG_USER, password: PG_PASS,
    database: 'postgres',
  });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  await admin.end();

  // schema: prisma db push against the new database (same schema as the app).
  // Prisma 6.19 ignores --url for db push, so the URL goes in via the child
  // env (DATABASE_URL of THIS process is untouched — it's a subprocess).
  // Paths resolve from cwd (CI and local both run jest from packages/web);
  // the prisma CLI lives in the hoisted root node_modules or the local one.
  const webDir = process.cwd();
  const schema = `${webDir}/prisma/schema.prisma`;
  const candidates = [
    `${webDir}/../../node_modules/prisma/build/index.js`, // monorepo root (hoisted)
    `${webDir}/node_modules/prisma/build/index.js`, // local install
  ];
  const fs = await import('node:fs');
  const prismaCli = candidates.find((p) => fs.existsSync(p));
  if (!prismaCli) throw new Error(`prisma CLI not found in ${candidates.join(', ')}`);
  const env = { ...process.env, DATABASE_URL: SANDBOX_URL };
  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'push', `--schema=${schema}`, '--skip-generate', '--accept-data-loss'],
    { stdio: 'pipe', env },
  );

  db = new PrismaClient({
    datasources: { db: { url: SANDBOX_URL } },
  });

  // ── fixtures in the sandbox ─────────────────────────
  const marker = `sim-${stamp}`;
  const me = await db.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = me.id;

  labelA = (await db.csld_label.create({
    data: { name: `${marker}-a`, is_required: false, is_authorized: true, added_by: userId },
  })).id;
  labelB = (await db.csld_label.create({
    data: { name: `${marker}-b`, is_required: false, is_authorized: true, added_by: userId },
  })).id;
  requiredLabel = (await db.csld_label.create({
    data: { name: `${marker}-req`, is_required: true, is_authorized: true, added_by: userId },
  })).id;
}, 120_000);

afterAll(async () => {
  try {
    await db?.$disconnect();
  } catch {
    /* already gone */
  }
  const { Client } = await import('pg');
  const admin = new Client({
    host: PG_HOST, port: Number(PG_PORT), user: PG_USER, password: PG_PASS,
    database: 'postgres',
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  await admin.end();
}, 60_000);

describe('similarityEngine: the 5-factor Java-parity computation', () => {
  it('ranks label-twins above label-foreign games', async () => {
    const { recalculateSimilarity } = await import('../scheduled/similarityEngine.js');
    const twin1 = await makeGame({ name: 'twin1', labels: [labelA, requiredLabel], totalRating: 5 });
    const twin2 = await makeGame({ name: 'twin2', labels: [labelA, requiredLabel], totalRating: 5 });
    const foreign = await makeGame({ name: 'foreign', labels: [labelB], totalRating: 5 });

    await recalculateSimilarity(db);

    const twins = await db.similar_games.findMany({
      where: { id_game1: twin1.id },
      orderBy: { similarity_coefficient: 'desc' },
    });
    expect(twins.length).toBeGreaterThan(0);

    const twinRow = twins.find((r) => r.id_game2 === twin2.id);
    const foreignRow = twins.find((r) => r.id_game2 === foreign.id);
    expect(twinRow).toBeDefined();
    expect(foreignRow).toBeDefined();
    // Identical label sets (incl. one required) => label factor 1.0
    expect(twinRow!.similarity_coefficient).toBeGreaterThan(foreignRow!.similarity_coefficient);

    // Identical twins: coefficient capped at 1
    expect(twinRow!.similarity_coefficient).toBeLessThanOrEqual(1.0000001);
    expect(twinRow!.similarity_coefficient).toBeGreaterThan(0.7);
  });

  it('stores at most 9 neighbours per game (top-9 contract)', async () => {
    const { recalculateSimilarity } = await import('../scheduled/similarityEngine.js');
    const target = await makeGame({ name: 'target', labels: [labelA], year: 2020, players: 20 });
    for (let i = 0; i < 12; i++) {
      await makeGame({
        name: `filler${i}`,
        labels: [labelA],
        year: 2020 + (i % 3),
        players: 20 + (i % 4),
        totalRating: 3 + (i % 5),
      });
    }

    await recalculateSimilarity(db);

    const rows = await db.similar_games.findMany({ where: { id_game1: target.id } });
    expect(rows.length).toBeLessThanOrEqual(9);
    expect(rows.length).toBeGreaterThan(0);
    // all stored coefficients are positive
    for (const r of rows) expect(r.similarity_coefficient).toBeGreaterThan(0);
  });

  it('required labels count double in the label factor', async () => {
    const { recalculateSimilarity } = await import('../scheduled/similarityEngine.js');
    // Full label-set equality (one required vs one optional shared): both
    // pairs are identical in shape, so the total must match exactly.
    const withReq1 = await makeGame({ name: 'req1', labels: [requiredLabel], totalRating: 4, year: 2020, players: 30 });
    const withReq2 = await makeGame({ name: 'req2', labels: [requiredLabel], totalRating: 4, year: 2020, players: 30 });
    const withOpt1 = await makeGame({ name: 'opt1', labels: [labelA], totalRating: 4, year: 2020, players: 30 });
    const withOpt2 = await makeGame({ name: 'opt2', labels: [labelA], totalRating: 4, year: 2020, players: 30 });
    await recalculateSimilarity(db);
    const reqRow = (await db.similar_games.findMany({ where: { id_game1: withReq1.id } }))
      .find((r) => r.id_game2 === withReq2.id);
    const optRow = (await db.similar_games.findMany({ where: { id_game1: withOpt1.id } }))
      .find((r) => r.id_game2 === withOpt2.id);
    expect(reqRow).toBeDefined();
    expect(optRow).toBeDefined();
    expect(reqRow!.similarity_coefficient).toBeCloseTo(optRow!.similarity_coefficient, 5);

    // The doubling is observable when the DIFFERING label is required:
    // A {req, optA} vs B {optA} — the differing label is required, so
    // distance 1+1=2, size 2+1=3 => label similarity 1/3. C {optB, optA}
    // vs D {optA} — differing label optional: distance 1, size 2 => 1/2.
    // The rule is a PENALTY: differing on a required label hurts twice as
    // much, so the required-differing pair must rank FARTHER apart.
    const reqDiffA = await makeGame({ name: 'rA', labels: [requiredLabel, labelA], year: 2020, players: 30, totalRating: 4 });
    const reqDiffB = await makeGame({ name: 'rB', labels: [labelA], year: 2020, players: 30, totalRating: 4 });
    const optDiffC = await makeGame({ name: 'oC', labels: [labelB, labelA], year: 2020, players: 30, totalRating: 4 });
    const optDiffD = await makeGame({ name: 'oD', labels: [labelA], year: 2020, players: 30, totalRating: 4 });
    await recalculateSimilarity(db);
    const reqPair = (await db.similar_games.findMany({ where: { id_game1: reqDiffA.id } }))
      .find((r) => r.id_game2 === reqDiffB.id);
    const optPair = (await db.similar_games.findMany({ where: { id_game1: optDiffC.id } }))
      .find((r) => r.id_game2 === optDiffD.id);
    expect(reqPair).toBeDefined();
    expect(optPair).toBeDefined();
    // exact values: 0.4·(1/3) + 0.6 = 0.7333 vs 0.4·(1/2) + 0.6 = 0.8
    expect(reqPair!.similarity_coefficient).toBeCloseTo(0.4 * (1 / 3) + 0.6, 5);
    expect(optPair!.similarity_coefficient).toBeCloseTo(0.4 * 0.5 + 0.6, 5);
    expect(reqPair!.similarity_coefficient).toBeLessThan(optPair!.similarity_coefficient);
  });

  it('a deleted game never enters anybody’s top-9', async () => {
    const { recalculateSimilarity } = await import('../scheduled/similarityEngine.js');
    const dead = await makeGame({ name: 'dead', labels: [labelA] });
    await db.csld_game.update({ where: { id: dead.id }, data: { deleted: true } });

    await recalculateSimilarity(db);

    const rows = await db.similar_games.findMany({
      where: { OR: [{ id_game1: dead.id }, { id_game2: dead.id }] },
    });
    expect(rows).toHaveLength(0);
  });
});

describe('tasks.ts: nightly orchestration', () => {
  it('recalculateAmountOfRatings corrects trigger drift', async () => {
    const { recalculateAmountOfRatings } = await import('../scheduled/tasks.js');
    const driftGame = await makeGame({ name: 'drift', totalRating: null });
    await db.csld_rating.create({ data: { game_id: driftGame.id, user_id: userId, rating: 4, state: 2 } });
    await db.csld_game.update({
      where: { id: driftGame.id },
      data: { amount_of_ratings: 42 }, // drifted far from the true count
    });

    await recalculateAmountOfRatings(db);

    const row = await db.csld_game.findUnique({ where: { id: driftGame.id } });
    expect(row!.amount_of_ratings).toBe(1);
  });

  it('runNightlyBatch completes with the INTEGRATE_* flags unset (importers skipped)', async () => {
    const { runNightlyBatch } = await import('../scheduled/tasks.js');
    const prevCalendar = process.env.INTEGRATE_CALENDAR;
    const prevArticles = process.env.INTEGRATE_ARTICLES;
    delete process.env.INTEGRATE_CALENDAR;
    delete process.env.INTEGRATE_ARTICLES;

    await expect(runNightlyBatch(db)).resolves.toBeUndefined();

    if (prevCalendar !== undefined) process.env.INTEGRATE_CALENDAR = prevCalendar;
    if (prevArticles !== undefined) process.env.INTEGRATE_ARTICLES = prevArticles;
  });
});

describe('passport.ts: session serialization round-trip (main test DB)', () => {
  it('serializeUser keeps the id and deserializeUser loads the account back', async () => {
    // Uses the SHARED test database via context — no batch jobs involved,
    // just a fixture account.
    const { prisma } = await import('../context.js');
    const { configurePassport } = await import('../auth/passport.js');
    const marker = `pp-${stamp}`;
    const me = await prisma.csld_csld_user.create({
      data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
    });
    const configured = configurePassport(prisma as any);

    const serialized: number | null = await new Promise((resolve) => {
      configured.serializeUser({ id: me.id } as any, (err: unknown, out: unknown) => {
        expect(err).toBeNull();
        resolve(out as number);
      });
    });
    expect(serialized).toBe(me.id);

    const deserialized = await new Promise((resolve, reject) => {
      configured.deserializeUser(me.id as any, (err: unknown, out: unknown) => {
        if (err) reject(err);
        else resolve(out);
      });
    });
    const user = deserialized as { id: number; email: string };
    expect(user.id).toBe(me.id);
    expect(user.email).toBe(`${marker}@integration.test`);

    await prisma.csld_csld_user.delete({ where: { id: me.id } });
  });

  it('deserializeUser of an unknown id yields a logged-out shape', async () => {
    const { prisma } = await import('../context.js');
    const { configurePassport } = await import('../auth/passport.js');
    const configured = configurePassport(prisma as any);

    const out = await new Promise((resolve) => {
      configured.deserializeUser(999_999_999 as any, (err: unknown, user: unknown) => {
        expect(err).toBeNull();
        resolve(user);
      });
    });
    // passport normalizes a null deserialization to `false` (its logged-out
    // sentinel) — falsy either way, never a stale session.
    expect(out == null || out === false).toBe(true);
  });
});
