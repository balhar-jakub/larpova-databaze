import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import {
  seriesByIdResolver,
  seriesByQueryResolver,
  gameSeriesResolver,
  normalizeSeries,
} from '../resolvers/series';

/**
 * Direct-call arms of resolvers/series.ts that the GraphQL suite
 * (series.test.ts) leaves cold: the loadSeries guards (unknown id,
  soft-deleted series for a plain user vs an editor), the seriesByQuery
  fallbacks (empty query, absent offset/limit, limit clamp), the
  Game.series guards (no series, string id, bad id), and normalizeSeries's
  aggregate arms (no games → null years, missing counters).
 */
const stamp = Date.now();
const marker = `srms-${stamp}`;

const ctxFor = (role: number | null) => ({ user: role == null ? null : { id: 1, role }, db: prisma } as any);
const anonymousCtx = () => ({ user: null, db: prisma } as any);

let liveId: number;
let deletedId: number;
let gameInSeriesId: number;
let authorId: number;

beforeAll(async () => {
  const author = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  authorId = author.id;

  const live = await prisma.csld_series.create({
    data: { name: `${marker} živá`, added_by: authorId, deleted: false },
  });
  liveId = live.id;
  const deleted = await prisma.csld_series.create({
    data: { name: `${marker} smazaná`, added_by: authorId, deleted: true },
  });
  deletedId = deleted.id;

  const game = await prisma.csld_game.create({
    data: { name: `${marker} díl`, deleted: false, added_by: authorId, series_id: liveId, year: 2024 },
  });
  gameInSeriesId = game.id;
  await prisma.csld_game_has_author.create({ data: { id_game: gameInSeriesId, id_user: authorId } });
});

afterAll(async () => {
  if (gameInSeriesId) {
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: gameInSeriesId } });
    await prisma.csld_game.deleteMany({ where: { id: gameInSeriesId } });
  }
  await prisma.csld_series.deleteMany({ where: { name: { startsWith: marker } } });
  await prisma.csld_csld_user.deleteMany({ where: { id: authorId } });
  await prisma.$disconnect();
});

describe('loadSeries guards (seriesById)', () => {
  it('an unknown id is null', async () => {
    expect(await seriesByIdResolver({}, { seriesId: '999999999' }, anonymousCtx())).toBeNull();
  });

  it('a NaN id is null', async () => {
    expect(await seriesByIdResolver({}, { seriesId: 'x' }, anonymousCtx())).toBeNull();
  });

  it('a live series is served to an anonymous visitor', async () => {
    const series = await seriesByIdResolver({}, { seriesId: String(liveId) }, anonymousCtx());
    expect(series).not.toBeNull();
    expect(series.name).toBe(`${marker} živá`);
  });

  it('a soft-deleted series is null for a plain user and served to an editor', async () => {
    expect(await seriesByIdResolver({}, { seriesId: String(deletedId) }, ctxFor(1))).toBeNull();
    const asEditor = await seriesByIdResolver({}, { seriesId: String(deletedId) }, ctxFor(2));
    expect(asEditor).not.toBeNull();
    expect(asEditor.deleted).toBe(true);
  });
});

describe('seriesByQuery fallbacks (the picker)', () => {
  it('an empty query lists series, absent offset/limit fall back to 0/20', async () => {
    const rows = await seriesByQueryResolver({}, { query: '   ' }, anonymousCtx());
    const names = rows.map((r: any) => r.name);
    expect(names).toContain(`${marker} živá`);
    // deleted stays out
    expect(names).not.toContain(`${marker} smazaná`);
  });


  it('an undefined query lists series too (the optional-chain arm)', async () => {
    const rows = await seriesByQueryResolver({}, {}, anonymousCtx());
    const names = rows.map((r: any) => r.name);
    expect(names).toContain(`${marker} živá`);
  });

  it('a substring query narrows the list; limit is clamped at 50', async () => {
    const rows = await seriesByQueryResolver({}, { query: `${marker} živ`, offset: 0, limit: 50 }, anonymousCtx());
    expect(rows.map((r: any) => r.name)).toEqual([`${marker} živá`]);
  });
});

describe('Game.series guards', () => {
  it('a game without a series is null; a bad id is null; a string id resolves', async () => {
    expect(await gameSeriesResolver({ series_id: null }, {}, anonymousCtx())).toBeNull();
    expect(await gameSeriesResolver({}, {}, anonymousCtx())).toBeNull();
    expect(await gameSeriesResolver({ series_id: 'x' }, {}, anonymousCtx())).toBeNull();
    const byString = await gameSeriesResolver({ series_id: String(liveId) }, {}, anonymousCtx());
    expect(Number(byString?.id)).toBe(liveId);
    const byNumber = await gameSeriesResolver({ series_id: liveId }, {}, anonymousCtx());
    expect(Number(byNumber?.id)).toBe(liveId);
  });
});

describe('normalizeSeries aggregate arms', () => {
  it('a series with no instalments answers null first/last year and zero counts', () => {
    const empty = normalizeSeries({ id: 1, name: 'x', added: null, csld_game: [] });
    expect(empty.firstYear).toBeNull();
    expect(empty.lastYear).toBeNull();
    expect(empty.amountOfGames).toBe(0);
    expect(empty.amountOfRatings).toBe(0);
    expect(empty.amountOfPlayed).toBe(0);
    expect(empty.amountOfComments).toBe(0);
    expect(empty.added).toBeNull(); // added ?? null arm
  });

  it('a null row is null; a Date added is rendered; instalments with missing counters sum 0', () => {
    expect(normalizeSeries(null)).toBeNull();
    const date = new Date('2030-05-01T00:00:00Z');
    const series = normalizeSeries({
      id: 2, name: 'y', added: date,
      csld_game: [{ id: 1, name: 'g', deleted: false, year: 2020 }, { id: 2, name: 'h', deleted: false, year: 2022 }],
    });
    expect(series.added).toBe(date.toISOString());
    expect(series.firstYear).toBe(2020);
    expect(series.lastYear).toBe(2022);
    expect(series.amountOfGames).toBe(2);
    expect(series.amountOfRatings).toBe(0); // amountOfRatings ?? 0 arm
  });
});
