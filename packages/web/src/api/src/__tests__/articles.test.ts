/**
 * Articles metadata API — `query { articles }` and `query { articleById }`.
 * The resolvers read `csld_article` rows written by the larpy.cz / larp.cz
 * import scripts; fixtures build their own rows (never seeded data).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { articlesResolver, articleByIdResolver } from '../resolvers/article.js';

const db = new PrismaClient();
const MARK = 'jest-article-test-';

async function createArticle(data: {
  source: string;
  sourceId: string;
  title: string;
  perex?: string | null;
  authors?: string | null;
  categories?: string[];
  tags?: string[];
}) {
  return db.csld_article.create({
    data: {
      source: data.source,
      source_id: data.sourceId,
      url: `https://example.com/${data.sourceId}`,
      title: data.title,
      perex: data.perex ?? null,
      language: 'cs',
      authors: data.authors ?? null,
      published_at: new Date('2024-05-01T12:00:00Z'),
      categories: data.categories ?? [],
      tags: data.tags ?? [],
    },
  });
}

describe('articles resolvers', () => {
  let first: Awaited<ReturnType<typeof createArticle>>;
  let second: Awaited<ReturnType<typeof createArticle>>;

  beforeAll(async () => {
    first = await createArticle({
      source: 'LARPY_CZ',
      sourceId: `${MARK}1`,
      title: 'Reportáž z parukářství',
      perex: 'Jak se vyrábí paruka pro larp.',
      authors: 'Jane Testová',
      categories: ['Praxe'],
      tags: ['paruky'],
    });
    second = await createArticle({
      source: 'LARP_CZ',
      sourceId: `${MARK}2`,
      title: 'Návod na výrobu zbroje',
      perex: 'PVC zbroj krok za krokem.',
      categories: ['Návody'],
    });
  });

  afterAll(async () => {
    await db.csld_article.deleteMany({ where: { source_id: { startsWith: MARK } } });
    await db.$disconnect();
  });

  it('lists articles scoped to the fixture rows', async () => {
    const result = await articlesResolver(null, {}, { db, user: null } as never);
    expect(result.totalAmount).toBeGreaterThanOrEqual(2);
    const ids = result.articles.map((a: { id: number }) => a.id);
    expect(ids).toContain(first.id);
    expect(ids).toContain(second.id);
  });

  it('filters by source', async () => {
    const result = await articlesResolver(
      null,
      { source: 'LARP_CZ' },
      { db, user: null } as never,
    );
    const ids = result.articles.map((a: { id: number }) => a.id);
    expect(ids).toContain(second.id);
    expect(ids).not.toContain(first.id);
  });

  it('rejects an unknown source', async () => {
    await expect(
      articlesResolver(null, { source: 'MADE_UP' }, { db, user: null } as never),
    ).rejects.toThrow('Unknown article source');
  });

  it('matches a diacritics-insensitive word-prefix query', async () => {
    const result = await articlesResolver(
      null,
      { query: 'reportaz' }, // no diacritics, real visitor spelling
      { db, user: null } as never,
    );
    const titles = result.articles.map((a: { title: string }) => a.title);
    expect(titles).toContain('Reportáž z parukářství');
    expect(result.totalAmount).toBeGreaterThanOrEqual(1);
  });

  it('resolves a single article by id with the mapped shape', async () => {
    const row = await articleByIdResolver(null, { articleId: String(first.id) }, {
      db,
      user: null,
    } as never);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(first.id);
    expect(row!.source).toBe('LARPY_CZ');
    expect(row!.sourceId).toBe(`${MARK}1`);
    expect(row!.url).toBe(`https://example.com/${MARK}1`);
    expect(row!.title).toBe('Reportáž z parukářství');
    expect(row!.perex).toBe('Jak se vyrábí paruka pro larp.');
    expect(row!.authors).toBe('Jane Testová');
    expect(row!.categories).toEqual(['Praxe']);
    expect(row!.tags).toEqual(['paruky']);
    expect(row!.games).toEqual([]);
    expect(typeof row!.publishedAt).toBe('string');
  });

  it('returns null for a missing id and for a non-numeric id', async () => {
    const missing = await articleByIdResolver(null, { articleId: '999999999' }, {
      db,
      user: null,
    } as never);
    expect(missing).toBeNull();
    const bogus = await articleByIdResolver(null, { articleId: 'abc' }, {
      db,
      user: null,
    } as never);
    expect(bogus).toBeNull();
  });
});
