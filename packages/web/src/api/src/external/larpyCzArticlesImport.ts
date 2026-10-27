import type { PrismaClient } from '@prisma/client';
import { articleExcerptAsText } from '../resolvers/article.js';

/**
 * Import article metadata from larpy.cz (WordPress).
 *
 * Reads the public WP REST API (`/wp-json/wp/v2/posts`), which exposes
 * title, excerpt, date, categories, tags, author and featured media without
 * any scraping. Czech posts only (English articles filtered by category);
 * incremental via `?after=` from the newest stored `fetched_at`.
 */

const WP_API = 'https://www.larpy.cz/wp-json/wp/v2';
const LARPY_CZ_SOURCE = 'LARPY_CZ';
/** Category "English articles" on larpy.cz — excluded from the Czech corpus. */
const ENGLISH_CATEGORY_ID = 1113;

/**
 * Fetch with retry — larpy.cz answers bursty callers with HTTP 429 and blocks
 * the default node User-Agent with 401 "User-Agent Rate Limit". Backs off
 * 5s / 15s / 30s before giving up.
 */
const IMPORT_UA = 'CSLD-Articles-Import/1.0 (+https://www.larpovadatabaze.cz)';

/** Minimum spacing between requests — larpy.cz throttles bursts. */
const REQUEST_SPACING_MS = 1_000;

/**
 * The pause between requests, in ms. Tests set this to ~0 via
 * `setRequestSpacing()`; the nightly import keeps the 1s default.
 */
let requestSpacingMs = REQUEST_SPACING_MS;

/** Test hook: collapse the inter-request pause (real spacing is 1s). */
export function setRequestSpacing(ms: number): void {
  requestSpacingMs = Math.max(0, ms);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  await sleep(requestSpacingMs);
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      // Real backoff is 5/15/30s; under the test hook (spacing 0) the
      // backoff collapses too, or a single throttled response would blow
      // the 5s jest timeout.
      const scale = requestSpacingMs / REQUEST_SPACING_MS;
      const delay = Math.round((attempt === 1 ? 5_000 : attempt === 2 ? 15_000 : 30_000) * scale);
      await new Promise((r) => setTimeout(r, delay));
    }
    lastRes = await fetch(url, { headers: { 'User-Agent': IMPORT_UA } });
    if (lastRes.ok || lastRes.status !== 429) return lastRes;
  }
  return lastRes!;
}

/** Reads ALL pages of a paged WP endpoint (tags exceed one page: 1000+). */
async function fetchAllPages<T>(url: string): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let totalPages: number;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetchWithRetry(`${url}${sep}per_page=100&page=${page}`);
    if (!res.ok) return out;
    totalPages = parseInt(res.headers.get('x-wp-totalpages') ?? '1', 10);
    out.push(...((await res.json()) as T[]));
    page += 1;
  } while (page <= totalPages);
  return out;
}

interface WpPost {
  id: number;
  slug: string;
  link: string;
  date_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  categories: number[];
  tags: number[];
  author: number;
  _embedded?: {
    author?: Array<{ name?: string }>;
    'wp:featuredmedia'?: Array<{ source_url?: string } | false>;
  };
}

interface WpTerm {
  id: number;
  name: string;
}

/** The embedded author and featured-media of a post; `/users/<id>` is
 * auth-gated on larpy.cz, so `_embed` carries both inside the payload. */
function postMedia(post: WpPost): { author: string | null; imageUrl: string | null } {
  const author = post._embedded?.author?.[0]?.name ?? null;
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const imageUrl =
    media && typeof media !== 'boolean' ? (media.source_url ?? null) : null;
  return { author, imageUrl };
}

/** Import the not-yet-known posts of one page, deduplicated by source id;
 * returns how many were created. */
async function importPosts(
  db: PrismaClient,
  posts: readonly WpPost[],
  categoryNames: ReadonlyMap<number, string>,
  tagNames: ReadonlyMap<number, string>,
): Promise<number> {
  let imported = 0;
  for (const post of posts) {
    const existing = await db.csld_article.findUnique({
      where: { source_source_id: { source: LARPY_CZ_SOURCE, source_id: String(post.id) } },
    });
    if (existing) continue;

    const { author, imageUrl } = postMedia(post);

    await db.csld_article.create({
      data: {
        source: LARPY_CZ_SOURCE,
        source_id: String(post.id),
        url: post.link,
        title: articleExcerptAsText(post.title.rendered),
        perex: post.excerpt?.rendered ? articleExcerptAsText(post.excerpt.rendered) : null,
        language: 'cs',
        authors: author,
        published_at: post.date_gmt ? new Date(post.date_gmt + 'Z') : null,
        categories: post.categories
          .filter((c) => c !== ENGLISH_CATEGORY_ID)
          .map((c) => categoryNames.get(c) ?? String(c)),
        tags: post.tags.map((t) => tagNames.get(t) ?? String(t)),
        image_url: imageUrl,
      },
    });
    imported += 1;
  }
  return imported;
}

export async function importLarpyCzArticles(db: PrismaClient): Promise<number> {
  // Warm the category/tag id → name maps (paged — tags exceed 1000 items).
  const categoryNames = new Map<number, string>();
  const tagNames = new Map<number, string>();
  try {
    for (const c of await fetchAllPages<WpTerm>(`${WP_API}/categories`)) {
      categoryNames.set(c.id, c.name);
    }
    for (const t of await fetchAllPages<WpTerm>(`${WP_API}/tags`)) {
      tagNames.set(t.id, t.name);
    }
  } catch {
    // Names are cosmetic; importing without them is better than failing.
  }

  // Incremental: fetch only posts newer than the newest stored one.
  const newest = await db.csld_article.findFirst({
    where: { source: LARPY_CZ_SOURCE },
    orderBy: { published_at: 'desc' },
  });
  const after = newest?.published_at
    ? `&after=${new Date(newest.published_at).toISOString()}`
    : '';

  let imported = 0;
  let page = 1;
  let totalPages: number;

  do {
    const res = await fetchWithRetry(
      `${WP_API}/posts?per_page=100&page=${page}&_embed${after}`,
    );
    if (!res.ok) {
      console.error(`larpy.cz import: page ${page} failed with ${res.status}`);
      return imported;
    }
    totalPages = parseInt(res.headers.get('x-wp-totalpages') ?? '1', 10);
    const posts = (await res.json()) as WpPost[];

    // The default listing hides English articles, but the category filter is
    // the authoritative guard (some may surface via `?after=` paging).
    const keep = posts.filter((p) => !p.categories.includes(ENGLISH_CATEGORY_ID));

    imported += await importPosts(db, keep, categoryNames, tagNames);
    page += 1;
  } while (page <= totalPages);

  console.log(`larpy.cz import: ${imported} new articles`);
  return imported;
}
