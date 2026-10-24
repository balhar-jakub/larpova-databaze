import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';
import { toAuthUser, isEditor } from '../auth/appUsers';
import { articlesResolver, mapArticleRow } from '../resolvers/article';
import { normalizeSeries } from '../resolvers/series';
import { eventCalendarStatsResolver } from '../resolvers/event';
import { linkGoogleIdentity } from '../auth/googleLink';

/**
 * The last tail of cold arms, direct calls where the HTTP/GraphQL layer is
 * not needed: toAuthUser's null-mapping arms (description/image) and the
 * isEditor matrix, the article pager's clamps (negative offset, oversized
 * limit), mapArticleRow's null categories/author, normalizeSeries's
 * null-ish reduce arms, eventCalendarStats on an event with no date, and
 * linkGoogleIdentity's non-P2002 rethrow.
 */
const stamp = Date.now();
const marker = `tailarms-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let userId: number;

beforeAll(async () => {
  server = createTestServer();
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('toAuthUser / isEditor', () => {
  it('maps a row with description and image, and one without', () => {
    const image = { id: 5, path: 'upload/x.png' };
    const rich = toAuthUser({
      id: 1, email: 'a@b.test', name: 'A', nickname: null,
      description: 'bio', gender: 1, role: 1,
      csld_image: image, amount_of_comments: 0, amount_of_played: 0, amount_of_created: 0,
    } as never);
    expect(rich.description).toBe('bio');
    expect((rich.image as any).path).toBe('upload/x.png');

    const bare = toAuthUser({
      id: 2, email: 'b@b.test', name: 'B', nickname: null,
      description: null, gender: null, role: 1,
      csld_image: null, amount_of_comments: 0, amount_of_played: 0, amount_of_created: 0,
    } as never);
    expect(bare.description).toBeNull();
    expect(bare.image).toBeNull();
    expect(bare.gender).toBeNull();
  });

  it('isEditor answers by role and false without a user', () => {
    expect(isEditor({ user: { role: 2 } } as never)).toBe(true);  // EDITOR
    expect(isEditor({ user: { role: 3 } } as never)).toBe(true);  // ADMIN
    expect(isEditor({ user: { role: 1 } } as never)).toBe(false); // USER
    expect(isEditor({ user: null } as never)).toBe(false);
  });
});

describe('article pager clamps and null mapping', () => {
  it('clamps a negative offset to 0 and an oversized limit to the ceiling', async () => {
    const page = (await articlesResolver(
      {},
      { offset: -50, limit: 10_000 } as never,
      { db: prisma } as never,
    )) as any;
    expect(page.articles.length).toBeLessThanOrEqual(100); // ARTICLES_MAX_LIMIT
    expect(page.totalAmount).toBeGreaterThanOrEqual(0);
  });

  it('mapArticleRow maps null categories/tags and a missing author to null', () => {
    const row = mapArticleRow({
      id: 1, source: 'LARPY_CZ', source_id: 'x', url: 'https://e.test/x',
      title: 'T', perex: null, language: 'cs', authors: null,
      published_at: null, categories: null, tags: null, image_url: null,
      csld_csld_user: null, csld_article_has_game: [],
    } as never);
    expect(row.categories).toEqual([]);
    expect(row.tags).toEqual([]);
    expect(row.author).toBeNull();
    expect(row.publishedAt).toBeNull();
  });
});

describe('normalizeSeries null-ish arms', () => {
  it('counts nullish amounts as zero and skips non-number years', () => {
    const series = normalizeSeries({
      id: 1, name: 'S',
      csld_game: [
        { id: 1, name: 'a', deleted: false, year: 2020, amount_of_ratings: null, amount_of_played: null, amount_of_comments: null },
        { id: 2, name: 'b', deleted: false, year: null, amount_of_ratings: 2, amount_of_played: 1, amount_of_comments: 1 },
      ],
    } as never);
    expect(series!.amountOfGames).toBe(2);
    expect(series!.amountOfRatings).toBe(2); // null ?? 0 + 2
    expect(series!.amountOfPlayed).toBe(1);
    expect(series!.amountOfComments).toBe(1);
    expect(series!.firstYear).toBe(2020); // the null year is skipped
  });

  it('answers null for a null row', () => {
    expect(normalizeSeries(null)).toBeNull();
  });
});

describe('eventCalendarStats on undated events', () => {
  it('skips an event with no start date', async () => {
    const undated = await prisma.event.create({
      data: { name: `${marker} bez data`, deleted: false, added_by: userId },
    });
    try {
      const stats = (await eventCalendarStatsResolver(
        {},
        {},
        { db: prisma, user: null } as never,
      )) as any;
      expect(stats.byMonth).toBeDefined();
      // the undated event never lands in any month bucket
      expect(JSON.stringify(stats.byMonth)).not.toContain(`${marker}`);
    } finally {
      await prisma.event.deleteMany({ where: { id: undated.id } });
    }
  });
});

describe('linkGoogleIdentity error arms', () => {
  it('rethrows a database failure that is not a unique violation', async () => {
    const boom = new Error('connection lost');
    const broken = {
      csld_oauth_account: {
        findUnique: async () => null,
        findFirst: async () => null,
        create: async () => {
          throw boom;
        },
      },
      csld_csld_user: {
        findMany: async () => [],
        findFirst: async () => null,
        create: async () => ({ id: 1 }),
      },
      $transaction: async (fn: (tx: unknown) => unknown) => fn(broken),
      // emailLookup's legacy path: exact normalized match first.
      $queryRaw: async () => [{ id: 42, email: 'x@y.test' }],
    };
    await expect(
      linkGoogleIdentity(broken as never, {
        sub: 'sub-x', email: 'x@y.test', emailVerified: true, name: 'X',
      }),
    ).rejects.toThrow('connection lost');
  });
});
