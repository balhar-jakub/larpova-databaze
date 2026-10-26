import * as cheerio from 'cheerio';
import type { PrismaClient } from '@prisma/client';
import { articleExcerptAsText } from '../resolvers/article.js';

/**
 * Import article metadata from larp.cz (Drupal).
 *
 * larp.cz has no JSON API; the article listing is HTML at
 * `/?q=cs/clanky&page=N` with article links shaped `/?q=cs/clanek/<id>/<slug>`
 * — the numeric id is the natural dedup key. Metadata (title, date, author,
 * category, tags) is scraped from the detail page of each NEW article only.
 */

const LARP_CZ_BASE = 'https://www.larp.cz';
const LISTING_URL = `${LARP_CZ_BASE}/?q=cs/clanky`;
const LARP_CZ_SOURCE = 'LARP_CZ';

/** Minimum spacing + UA — larp.cz may throttle bursty default fetches. */
const IMPORT_UA = 'CSLD-Articles-Import/1.0 (+https://www.larpovadatabaze.cz)';
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

async function fetchSpaced(url: string): Promise<Response> {
  await new Promise((r) => setTimeout(r, requestSpacingMs));
  return fetch(url, { headers: { 'User-Agent': IMPORT_UA } });
}

interface ScrapedArticle {
  sourceId: string;
  url: string;
  title: string;
  perex: string | null;
  authors: string | null;
  publishedAt: Date | null;
  categories: string[];
  tags: string[];
}

/** Extracts `(id, slug)` pairs from a listing page's article links. */
function parseListing(html: string): Array<{ id: string; path: string }> {
  const $ = cheerio.load(html);
  const found = new Map<string, string>();
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/^\/\?q=cs\/clanek\/(\d+)\/[^#]*/);
    if (match && !found.has(match[1])) found.set(match[1], `${LARP_CZ_BASE}${href}`);
  });
  return [...found.entries()].map(([id, url]) => ({ id, path: url }));
}

/** Czech month names as printed by larp.cz ("13 Červen 2018"). */
const CZECH_MONTHS: Record<string, number> = {
  'leden': 1, 'únor': 2, 'unor': 2, 'březen': 3, 'brezen': 3, 'duben': 4,
  'květen': 5, 'kveten': 5, 'červen': 6, 'cerven': 6, 'červenec': 7, 'cervenec': 7,
  'srpen': 8, 'září': 9, 'zari': 9, 'říjen': 10, 'rijen': 10,
  'listopad': 11, 'prosinec': 12,
};

/** "13 Červen 2018" / "13. Červen 2018" → UTC date, or null when the text is
 * not a date larp.cz actually prints. */
function parseCzechDate(rawDate: string): Date | null {
  const dateMatch = rawDate.match(/(\d{1,2})\.\s*(\S+)\s*(\d{4})/) ||
    rawDate.match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (!dateMatch) return null;
  const month = CZECH_MONTHS[dateMatch[2].toLowerCase()];
  if (!month) return null;
  const d = new Date(Date.UTC(+dateMatch[3], month - 1, +dateMatch[1]));
  return isNaN(d.getTime()) ? null : d;
}

/** Perex: the first non-heading paragraph with real text. Skips the metadata
 * block (`.metanode` is a <p> too: "Redakce LARP.cz - zveřejněno30 Srpen 2011")
 * and anything that still smells like metadata after cleanup. */
function scrapePerex($: cheerio.CheerioAPI): string | null {
  let perex: string | null = null;
  $('p, .perex, .teaser').each((_i, el) => {
    if (perex) return;
    if ($(el).closest('.metanode').length > 0) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length <= 40) return;
    const clean = articleExcerptAsText(text);
    if (/zveřejněno\s*\d/i.test(clean)) return; // metadata, not a perex
    perex = clean.slice(0, 500);
  });
  return perex;
}

/** Unique trimmed texts of the links matching `selector` in the taxonomy
 * block (optionally length-capped, as tags are). */
function scrapeTaxonomy($: cheerio.CheerioAPI, selector: string, maxNameLength?: number): string[] {
  const names: string[] = [];
  $(selector).each((_i, el) => {
    const name = $(el).text().trim();
    if (name && (maxNameLength === undefined || name.length < maxNameLength) && !names.includes(name)) {
      names.push(name);
    }
  });
  return names;
}

/** Scrapes one article detail page for its metadata. */
export function parseDetail(html: string, sourceId: string, url: string): ScrapedArticle | null {
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() || $('h2').first().text().trim();
  if (!title) return null;

  // Metadata block: `.metanode` holds `<span class="author"><a>Nick</a></span>
  // - zveřejněno<span class="date">13 Červen 2018</span>`.
  const meta = $('.metanode').first();
  const authors = meta.find('.author a').first().text().trim() || null;
  const publishedAt = parseCzechDate(meta.find('.date').first().text().trim());

  const perex = scrapePerex($);

  // Rubric: the taxonomy section ("štítky Pro organizátory…") names the real
  // section — NOT the menu links, which also match `cs/clanky/`.
  const categories = scrapeTaxonomy($, '.taxonomy a[href*="cs/clanky/"]');
  // Tags: links to /?q=cs/tagy/<slug> in the taxonomy block.
  const tags = scrapeTaxonomy($, '.taxonomy a[href*="cs/tagy/"]', 60);

  return { sourceId, url, title, perex, authors, publishedAt, categories, tags };
}

export async function importLarpCzArticles(db: PrismaClient): Promise<number> {
  // The listing paginates with ?page=N; collect ids from ALL pages once,
  // then scrape only the details of articles not yet in the DB.
  const seen = new Map<string, string>(); // id -> detail url
  let page = 0;
  const perPage = 7; // observed listing page size
  for (let guard = 0; guard < 100; guard++) {
    const res = await fetchSpaced(`${LISTING_URL}&page=${page}`);
    if (!res.ok) break;
    const html = await res.text();
    const items = parseListing(html);
    if (items.length === 0) break;
    let added = 0;
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.set(item.id, item.path);
        added += 1;
      }
    }
    // Stop when a page adds nothing new (repeat) or is the short last page.
    if (added === 0 || items.length < perPage) break;
    page += 1;
  }

  let imported = 0;
  const skipped = { total: 0, noDetail: 0 };
  for (const [id, url] of seen) {
    skipped.total += 1;
    const existing = await db.csld_article.findUnique({
      where: { source_source_id: { source: LARP_CZ_SOURCE, source_id: id } },
    });
    if (existing) continue;

    const res = await fetchSpaced(url);
    if (!res.ok) {
      console.error(`larp.cz import: detail ${id} failed with ${res.status}`);
      skipped.noDetail += 1;
      continue;
    }
    const scraped = parseDetail(await res.text(), id, url);
    if (!scraped) {
      console.error(`larp.cz import: detail ${id} has no parseable title`);
      skipped.noDetail += 1;
      continue;
    }

    await db.csld_article.create({
      data: {
        source: LARP_CZ_SOURCE,
        source_id: scraped.sourceId,
        url: scraped.url,
        title: scraped.title,
        perex: scraped.perex,
        language: 'cs',
        authors: scraped.authors,
        published_at: scraped.publishedAt,
        categories: scraped.categories,
        tags: scraped.tags,
      },
    });
    imported += 1;
  }

  console.log(
    `larp.cz import: ${imported} new articles (${seen.size} ids seen, ${skipped.noDetail} unparsable)`,
  );
  return imported;
}
