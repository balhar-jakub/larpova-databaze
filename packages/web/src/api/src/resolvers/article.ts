import type { Context } from '../context.js';
import { normalizeGame, normalizeUserRef } from './mappers.js';

/**
 * Metadata of larp articles published in Czech — `query { articles }`,
 * `query { articleById }`. Sourced from larpy.cz (WordPress REST API) and
 * larp.cz (scraped), written by the import scripts in `external/`.
 */

const ARTICLES_DEFAULT_LIMIT = 50;
const ARTICLES_MAX_LIMIT = 100;

/** The DB stores `source` as a plain string; the enum values are the vocabulary. */
const ARTICLE_SOURCES = ['LARPY_CZ', 'LARP_CZ'] as const;

export interface ArticleRow {
  id: number;
  source: string;
  source_id: string;
  url: string;
  title: string;
  perex: string | null;
  language: string;
  authors: string | null;
  author_id: number | null;
  published_at: Date | null;
  categories: string[];
  tags: string[];
  image_url: string | null;
}

/**
 * Strips HTML tags and entities, collapses whitespace — the source excerpt
 * (`excerpt.rendered` from WordPress) and scraped perexes arrive as markup.
 */
export function articleExcerptAsText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&hellip;|&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Maps a raw `csld_article` row to the GraphQL `Article` shape. */
export function mapArticleRow(
  row: ArticleRow & {
    csld_article_has_game?: Array<{ csld_game: unknown }> | null;
    csld_csld_user?: unknown | null;
  },
) {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.source_id,
    url: row.url,
    title: row.title,
    perex: row.perex,
    language: row.language,
    authors: row.authors,
    publishedAt: row.published_at
      ? new Date(row.published_at).toISOString()
      : null,
    categories: row.categories ?? [],
    tags: row.tags ?? [],
    imageUrl: row.image_url,
    author: row.csld_csld_user ? normalizeUserRef(row.csld_csld_user as never) : null,
    games: (row.csld_article_has_game ?? [])
      .map((j) => j.csld_game)
      .filter((g) => Boolean(g))
      .map((g) => normalizeGame(g as never)),
  };
}

/** `query { articles }` — the article list with the honest total for a pager. */
export async function articlesResolver(
  _parent: unknown,
  args: {
    source?: string | null;
    query?: string | null;
    offset?: number | null;
    limit?: number | null;
  },
  ctx: Context,
) {
  const offset = Math.max(0, args.offset ?? 0);
  const limit = Math.min(
    ARTICLES_MAX_LIMIT,
    Math.max(1, args.limit ?? ARTICLES_DEFAULT_LIMIT),
  );

  const where: Record<string, unknown> = { language: 'cs' };

  if (args.source) {
    if (!ARTICLE_SOURCES.includes(args.source as (typeof ARTICLE_SOURCES)[number])) {
      throw new Error(`Unknown article source: ${args.source}`);
    }
    where.source = args.source;
  }

  if (args.query) {
    // Diacritics-insensitive contains, the convention of the other query
    // resolvers: compare the unaccented lowercase needle against the
    // unaccented lowercase haystack.
    const needle = stripDiacritics(args.query.toLowerCase());
    const articles = await ctx.db.csld_article.findMany({
      where,
      orderBy: { published_at: 'desc' },
    });
    const matched = articles.filter((row: ArticleRow) => {
      const title = stripDiacritics(row.title.toLowerCase());
      const perex = stripDiacritics((row.perex ?? '').toLowerCase());
      const haystack = `${title} ${perex}`;
      // Word-prefix matching, same contract as the search page.
      return needle
        .split(/\s+/)
        .filter(Boolean)
        .every((word: string) => haystack.includes(word));
    });
    return {
      articles: matched
        .slice(offset, offset + limit)
        .map((row) => mapArticleRow(row)),
      totalAmount: matched.length,
    };
  }

  const [rows, totalAmount] = await Promise.all([
    ctx.db.csld_article.findMany({
      where,
      orderBy: { published_at: 'desc' },
      skip: offset,
      take: limit,
      include: {
        csld_article_has_game: { include: { csld_game: true } },
        csld_csld_user: true,
      },
    }),
    ctx.db.csld_article.count({ where }),
  ]);

  return {
    articles: rows.map((row) => mapArticleRow(row as never)),
    totalAmount,
  };
}

/** `query { articleById }`. */
export async function articleByIdResolver(
  _parent: unknown,
  args: { articleId: string },
  ctx: Context,
) {
  const id = parseInt(args.articleId, 10);
  if (isNaN(id)) return null;

  const row = await ctx.db.csld_article.findUnique({
    where: { id },
    include: {
      csld_article_has_game: { include: { csld_game: true } },
      csld_csld_user: true,
    },
  });

  if (!row) return null;
  return mapArticleRow(row as never);
}

/**
 * `Game.articles` — articles about the game, newest first. Resolved per
 * game row (not via the include of `gameByIdResolver`) so it stays lazy:
 * only the detail query that selects `articles` pays for the join.
 */
export async function gameArticlesResolver(
  parent: { id: number | string },
  _args: unknown,
  ctx: Context,
) {
  const gameId = typeof parent.id === 'string' ? parseInt(parent.id, 10) : parent.id;
  if (!gameId || isNaN(gameId)) return [];

  const rows = await ctx.db.csld_article.findMany({
    where: {
      language: 'cs',
      csld_article_has_game: { some: { game_id: gameId } },
    },
    orderBy: { published_at: 'desc' },
    include: {
      csld_article_has_game: { include: { csld_game: true } },
      csld_csld_user: true,
    },
  });

  return rows.map((row) => mapArticleRow(row as never));
}

/**
 * Removes Czech diacritics for the diacritics-insensitive query matching.
 * Same normalization the search resolvers apply.
 */
function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
