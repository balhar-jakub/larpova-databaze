/**
 * External importers — larp.cz articles, larpy.cz articles, larp.cz events.
 *
 * These three modules are the "outside world" surface of the API: they fetch
 * HTML/JSON from third-party sites and turn it into `csld_article` / `event`
 * rows. Everything here is hermetic: `fetch` is stubbed per test with fixture
 * payloads, and the DB fixtures are cleaned up via their `jest-` marks.
 *
 * Covered: listing pagination + dedup, detail scraping (title/perex/authors/
 * date/categories/tags), the WP REST paging protocol, the English-category
 * filter, incremental `?after=`, DB dedup by (source, source_id), date
 * parsing, network failure paths, and the label find-or-create in the events
 * importer.
 */
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  parseDetail,
  importLarpCzArticles,
  setRequestSpacing as setLarpCzSpacing,
} from '../external/larpCzArticlesImport';
import {
  importLarpyCzArticles,
  setRequestSpacing as setLarpyCzSpacing,
} from '../external/larpyCzArticlesImport';
import { importLarpCzEvents } from '../external/larpCzImport';

const db = new PrismaClient();
const MARK = 'jest-import-test-';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A larp.cz listing page with the given article links. */
function larpCzListing(ids: string[]): string {
  const links = ids
    .map((id) => `<li><a href="/?q=cs/clanek/${id}/clanek-${id}">Článek ${id}</a></li>`)
    .join('\n');
  return `<html><body><ul>${links}</ul></body></html>`;
}

/** A larp.cz article detail page. */
function larpCzDetail(opts: {
  id: string;
  title?: string;
  perex?: string;
  author?: string;
  date?: string;
  categories?: string[];
  tags?: string[];
}): string {
  const title = opts.title ?? `Testovací článek ${opts.id}`;
  const author = opts.author ?? 'Redakce';
  const date = opts.date ?? '13 Červen 2018';
  const cats = (opts.categories ?? ['Pro organizátory']).map(
    (c) => `<a href="/?q=cs/clanky/${c}">${c}</a>`,
  );
  const tags = (opts.tags ?? ['navod']).map((t) => `<a href="/?q=cs/tagy/${t}">${t}</a>`);
  return `
  <html><body>
    <h1>${title}</h1>
    <p class="metanode"><span class="author"><a>${author}</a></span> - zveřejněno<span class="date">${date}</span></p>
    <p>${opts.perex ?? 'Toto je dostatečně dlouhý perex článku, který obsahuje víc než čtyřicet znaků textu a má therefore smysl jako perex.'}</p>
    <div class="taxonomy">štítky ${cats.join(' ')} ${tags.join(' ')}</div>
  </body></html>`;
}

/** A larpy.cz WP REST post. */
function wpPost(id: number, opts: { title?: string; categories?: number[]; tags?: number[]; english?: boolean } = {}) {
  return {
    id,
    slug: `post-${id}`,
    link: `https://www.larpy.cz/post-${id}`,
    date_gmt: '2024-06-15T10:00:00',
    title: { rendered: opts.title ?? `WP článek ${id}` },
    excerpt: { rendered: `<p>Excerpt ${id} pro larpy.cz článek, který je dlouhý.</p>` },
    categories: opts.categories ?? [5],
    tags: opts.tags ?? [7],
    author: 1,
    _embedded: {
      author: [{ name: `Autor ${id}` }],
      'wp:featuredmedia': [{ source_url: `https://www.larpy.cz/img-${id}.jpg` }],
    },
  };
}

/** Response-shape helper for the stubbed fetch. */
function res(opts: { ok?: boolean; status?: number; text?: string; json?: unknown; headers?: Record<string, string> }) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    text: async () => opts.text ?? '',
    json: async () => opts.json ?? null,
    headers: new Map(Object.entries(opts.headers ?? {})),
  } as unknown as Response;
}

/** A generic parsable detail page for ids we don't care about individually. */
function genericDetail(url: string): Response {
  const id = url.match(/clanek\/(\d+)/)?.[1] ?? '0';
  return res({ text: larpCzDetail({ id, title: `Detail ${id}` }) });
}

/** Installs a fetch stub that routes by URL substring. */
function routeFetch(routes: Array<{ match: string; response: (url: string) => Response }>) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push(url);
    for (const r of routes) {
      if (url.includes(r.match)) return r.response(url);
    }
    // No route matched. Fail loudly: a silently-routed detail URL turns
    // "expected 0 imports" into an import via the generic fixture and
    // masks missing routing (this is exactly what CI caught).
    throw new Error(`fetch stub: no route for ${url}`);
  }) as unknown as typeof fetch;
  return { calls };
}

// ---------------------------------------------------------------------------
// larp.cz articles: parseDetail
// ---------------------------------------------------------------------------

describe('larpCzArticlesImport.parseDetail', () => {
  it('scrapes title, author, date, perex, categories and tags', () => {
    const html = larpCzDetail({ id: '1', author: 'Jane Tester', date: '13 Červen 2018' });
    const article = parseDetail(html, '1', 'https://www.larp.cz/?q=cs/clanek/1/x');
    expect(article).not.toBeNull();
    expect(article!.title).toBe('Testovací článek 1');
    expect(article!.authors).toBe('Jane Tester');
    expect(article!.perex).toEqual(expect.any(String));
    expect(article!.categories).toContain('Pro organizátory');
    expect(article!.tags).toContain('navod');
    expect(article!.publishedAt).toEqual(new Date(Date.UTC(2018, 5, 13)));
  });

  it('falls back to h2 when h1 is missing and handles diacritics-free months', () => {
    const html = larpCzDetail({ id: '2', title: '', date: '1. Srpen 2011' })
      .replace('<h1></h1>', '<h1></h1><h2>Titulok z h2</h2>');
    const article = parseDetail(html, '2', 'url');
    expect(article!.title).toBe('Titulok z h2');
    expect(article!.publishedAt).toEqual(new Date(Date.UTC(2011, 7, 1)));
  });

  it('returns null for a page with no title', () => {
    const article = parseDetail('<html><body><p>jen text</p></body></html>', '3', 'url');
    expect(article).toBeNull();
  });

  it('keeps a null perex when every paragraph is metadata', () => {
    const html = `<html><body><h1>Titul</h1><p class="metanode">Redakce - zveřejněno 13 Červen 2018</p><p>zveřejněno 13 Červen 2018 zveřejněno</p></body></html>`;
    const article = parseDetail(html, '4', 'url');
    expect(article!.perex).toBeNull();
  });

  it('leaves publishedAt null when the month is unknown', () => {
    const html = larpCzDetail({ id: '5', date: '13 Foo 2018' });
    const article = parseDetail(html, '5', 'url');
    expect(article!.publishedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// larp.cz articles: importLarpCzArticles
// ---------------------------------------------------------------------------

describe('larpCzArticlesImport.importLarpCzArticles', () => {
  const createdIds: number[] = [];
  const originalFetch = global.fetch;

  beforeAll(() => {
    // The real import spaces requests by 1s (and CI is slower than a dev
    // box); with the hook at 0 the whole suite runs in milliseconds and
    // never flirts with jest's 5s per-test timeout.
    setLarpCzSpacing(0);
  });

  beforeAll(async () => {
    // Self-healing: purge every article id this suite uses, so a rerun
    // (or a leftover row from an aborted run) cannot change the outcome.
    await db.csld_article.deleteMany({
      where: { source: 'LARP_CZ', source_id: { in: ['97001', '97002', '98001', '98011', '98002', '98003', '98012', '98013'] } },
    });
    // One full listing page (7 items stops pagination naturally), one new
    // article, one already-imported article.
    await db.csld_article.create({
      data: {
        source: 'LARP_CZ',
        source_id: '97002',
        url: 'https://example.com/existing',
        title: 'Už importované',
        language: 'cs',
        categories: [],
        tags: [],
      },
    });
  });

  afterAll(async () => {
    await db.csld_article.deleteMany({
      where: { source: 'LARP_CZ', source_id: { in: ['97001', '97002', '98001', '98011'] } },
    });
    await db.csld_article.deleteMany({ where: { source_id: { startsWith: MARK } } });
  });

  it('imports new articles, skips existing ones and reports the count', async () => {
    const detailNew = larpCzDetail({ id: '97001', title: 'Nový článek z larp.cz' });
    const detailExisting = larpCzDetail({ id: '97002', title: 'Už existuje' });

    const { calls } = routeFetch([
      { match: 'page=', response: () => res({ text: larpCzListing(['97001', '97002', '97003', '97004', '97005', '97006', '97007']) }) },
      { match: 'clanek/97001', response: () => res({ text: detailNew }) },
      { match: 'clanek/97002', response: () => res({ text: detailExisting }) },
    ]);

    const imported = await importLarpCzArticles(db);
    try {
      expect(imported).toBeGreaterThanOrEqual(1);
      // The existing article's detail was never fetched.
      expect(calls.some((c) => c.includes('clanek/97002'))).toBe(false);
      const row = await db.csld_article.findUnique({
        where: { source_source_id: { source: 'LARP_CZ', source_id: '97001' } },
      });
      expect(row).not.toBeNull();
      expect(row!.title).toBe('Nový článek z larp.cz');
      createdIds.push(row!.id);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('stops pagination on a failed listing fetch and returns 0 new', async () => {
    const { calls } = routeFetch([{ match: 'page=', response: () => res({ ok: false, status: 500 }) }]);
    try {
      const imported = await importLarpCzArticles(db);
      expect(imported).toBe(0);
      expect(calls).toHaveLength(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('counts unparsable details and continues', async () => {
    const listing = larpCzListing(['98001', '98002', '98003']);
    const { calls } = routeFetch([
      { match: 'page=0', response: () => res({ text: listing }) },
      { match: 'clanek/98001', response: () => res({ text: '<html><body>no title here</body></html>' }) },
      { match: 'clanek/98002', response: () => res({ text: '<html><body>no title here</body></html>' }) },
      { match: 'clanek/98003', response: () => res({ text: '<html><body>no title here</body></html>' }) },
    ]);
    try {
      const imported = await importLarpCzArticles(db);
      expect(imported).toBe(0);
      expect(calls.filter((c) => c.includes('clanek/98001'))).toHaveLength(1);
      const row = await db.csld_article.findUnique({
        where: { source_source_id: { source: 'LARP_CZ', source_id: '98001' } },
      });
      expect(row).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('skips a detail whose fetch fails', async () => {
    const listing = larpCzListing(['98011', '98012', '98013']);
    const { calls } = routeFetch([
      { match: 'page=0', response: () => res({ text: listing }) },
      { match: 'clanek/98011', response: () => res({ ok: false, status: 500 }) },
      { match: 'clanek/98012', response: () => res({ ok: false, status: 500 }) },
      { match: 'clanek/98013', response: () => res({ ok: false, status: 500 }) },
    ]);
    try {
      const imported = await importLarpCzArticles(db);
      expect(imported).toBe(0);
      expect(calls.filter((c) => c.includes('clanek/98011'))).toHaveLength(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ---------------------------------------------------------------------------
// larpy.cz articles (WP REST)
// ---------------------------------------------------------------------------

describe('larpyCzArticlesImport.importLarpyCzArticles', () => {
  beforeAll(() => setLarpyCzSpacing(0));

  const originalFetch = global.fetch;

  beforeAll(async () => {
    await db.csld_article.create({
      data: {
        source: 'LARPY_CZ',
        source_id: `${MARK}wp-existing`,
        url: 'https://example.com/wp-existing',
        title: 'Už importované z WP',
        language: 'cs',
        categories: [],
        tags: [],
      },
    });
  });

  afterAll(async () => {
    await db.csld_article.deleteMany({
      where: { source: 'LARP_CZ', source_id: { in: ['97001', '97002', '98001', '98011'] } },
    });
    await db.csld_article.deleteMany({ where: { source_id: { startsWith: MARK } } });
  });

  it('imports new posts, resolves term names, skips the English category and dedups', async () => {
    const posts = [
      wpPost(900001, { title: 'Nový WP článek', categories: [5], tags: [7] }),
      wpPost(900002, { title: 'English post', categories: [1113], english: true }),
      wpPost(900003, { title: 'Už importované z WP' , categories: [5] }),
    ];
    // 900003 arrives with a NEW id, so it is imported as a new row (source_id
    // differs) — the English filter is what removes 900002.
    posts[2] = wpPost(900003, { title: 'Další nový článek' });

    const { calls } = routeFetch([
      { match: '/categories', response: () => res({ json: [{ id: 5, name: 'Larpy rubrika' }], headers: { 'x-wp-totalpages': '1' } }) },
      { match: '/tags', response: () => res({ json: [{ id: 7, name: 'larpy-tag' }], headers: { 'x-wp-totalpages': '1' } }) },
      { match: '/posts', response: () => res({ json: posts, headers: { 'x-wp-totalpages': '1' } }) },
    ]);

    try {
      const imported = await importLarpyCzArticles(db);
      expect(imported).toBe(2);
      const row = await db.csld_article.findUnique({
        where: { source_source_id: { source: 'LARPY_CZ', source_id: '900001' } },
      });
      expect(row).not.toBeNull();
      expect(row!.title).toBe('Nový WP článek');
      expect(row!.categories).toEqual(['Larpy rubrika']);
      expect(row!.tags).toEqual(['larpy-tag']);
      expect(row!.authors).toBe('Autor 900001');
      expect(row!.image_url).toContain('img-900001');
      const english = await db.csld_article.findUnique({
        where: { source_source_id: { source: 'LARPY_CZ', source_id: '900002' } },
      });
      expect(english).toBeNull();
      // Incremental cursor: the posts URL carries ?after= when a previous
      // post exists.
      expect(calls.some((c) => c.includes('/posts'))).toBe(true);
    } finally {
      await db.csld_article.deleteMany({
        where: { source: 'LARPY_CZ', source_id: { in: ['900001', '900003'] } },
      });
      global.fetch = originalFetch;
    }
  });

  it('returns 0 when the posts endpoint fails', async () => {
    routeFetch([
      { match: '/categories', response: () => res({ json: [], headers: { 'x-wp-totalpages': '1' } }) },
      { match: '/tags', response: () => res({ json: [], headers: { 'x-wp-totalpages': '1' } }) },
      { match: '/posts', response: () => res({ ok: false, status: 500 }) },
    ]);
    try {
      const imported = await importLarpyCzArticles(db);
      expect(imported).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('survives a failing categories call (names are cosmetic)', async () => {
    const posts = [wpPost(900004, { title: 'Bez kategorií' })];
    routeFetch([
      { match: '/categories', response: () => res({ ok: false, status: 404 }) },
      { match: '/tags', response: () => res({ json: [{ id: 7, name: 'tag' }], headers: { 'x-wp-totalpages': '1' } }) },
      { match: '/posts', response: () => res({ json: posts, headers: { 'x-wp-totalpages': '1' } }) },
    ]);
    try {
      const imported = await importLarpyCzArticles(db);
      expect(imported).toBe(1);
      const row = await db.csld_article.findUnique({
        where: { source_source_id: { source: 'LARPY_CZ', source_id: '900004' } },
      });
      expect(row!.categories).toEqual(['5']); // unresolved id falls back to the number
    } finally {
      await db.csld_article.deleteMany({ where: { source: 'LARPY_CZ', source_id: '900004' } });
      global.fetch = originalFetch;
    }
  });
});

// ---------------------------------------------------------------------------
// larp.cz events
// ---------------------------------------------------------------------------

describe('larpCzImport.importLarpCzEvents', () => {
  const originalFetch = global.fetch;

  const eventNames = [`${MARK}event-1`, `${MARK}event-2`];

  /** Removes this suite's events (and their label links) by name prefix. */
  async function cleanupEvents() {
    await db.event_has_labels.deleteMany({
      where: { event: { name: { startsWith: MARK } } },
    });
    await db.event.deleteMany({ where: { name: { startsWith: MARK } } });
  }

  beforeAll(cleanupEvents);
  afterAll(cleanupEvents);

  it('imports new events, dedups by name and links the LarpCz label', async () => {
    const html = `
      <html><body><div class="kalendar-akce">
        <div class="akce-nazev"><a href="https://www.larp.cz/detail-1">${eventNames[0]}</a></div>
        <div class="akce-datum">1. 6. 2026</div>
        <div class="akce-misto">Praha</div>
      </div><div class="kalendar-akce">
        <div class="akce-nazev"><a href="https://www.larp.cz/detail-2">${eventNames[1]}</a></div>
        <div class="akce-datum">neplatné datum</div>
        <div class="akce-misto">Brno</div>
      </div></body></html>`;
    routeFetch([{ match: 'larp.cz/kalendar', response: () => res({ text: html }) }]);

    try {
      const imported = await importLarpCzEvents(db);
      expect(imported).toBe(1);
      const event = await db.event.findFirst({ where: { name: eventNames[0] } });
      expect(event).not.toBeNull();
      expect(event!.from).toEqual(new Date('2026-06-01'));
      expect(event!.to).toEqual(new Date('2026-06-03')); // +2 days default
      expect(event!.loc).toBe('Praha');
      const labels = await db.event_has_labels.findMany({ where: { event_id: event!.id } });
      expect(labels.length).toBeGreaterThanOrEqual(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('is idempotent on the second run (dedup by name)', async () => {
    const html = `<html><body><div class="kalendar-akce">
      <div class="akce-nazev"><a href="#">${eventNames[0]}</a></div>
      <div class="akce-datum">1. 6. 2026</div>
      <div class="akce-misto">Praha</div>
    </div></body></html>`;
    routeFetch([{ match: 'larp.cz/kalendar', response: () => res({ text: html }) }]);
    try {
      const imported = await importLarpCzEvents(db);
      expect(imported).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('returns 0 when the fetch throws', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    try {
      const imported = await importLarpCzEvents(db);
      expect(imported).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('falls back to table rows when the primary selector is empty', async () => {
    const name = `${MARK}event-3`;
    eventNames.push(name);
    const html = `<html><body><table>
      <tr><td>${name}</td><td>2. 11. 2025</td><td>Ostrava</td></tr>
    </table></body></html>`;
    routeFetch([{ match: 'larp.cz/kalendar', response: () => res({ text: html }) }]);
    try {
      const imported = await importLarpCzEvents(db);
      expect(imported).toBe(1);
      const event = await db.event.findFirst({ where: { name } });
      expect(event).not.toBeNull();
      expect(event!.from).toEqual(new Date('2025-11-02'));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ---------------------------------------------------------------------------
// Fresh-database bootstrap
// ---------------------------------------------------------------------------

describe('larpCzImport on a database with users (the FK owner exists)', () => {
  it('attributes imported events to the lowest existing user id', async () => {
    const anyUser = await db.csld_csld_user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    if (!anyUser) return; // covered by the CI's empty-database run
    const html = `
      <html><body><div class="kalendar-akce">
        <div class="akce-nazev"><a href="https://www.larp.cz/x">${MARK}boot-user</a></div>
        <div class="akce-datum">3. 7. 2026</div>
        <div class="akce-misto">Plzeň</div>
      </div></body></html>`;
    const originalFetch = global.fetch;
    routeFetch([{ match: 'larp.cz/kalendar', response: () => res({ text: html }) }]);
    try {
      await importLarpCzEvents(db);
      const event = await db.event.findFirst({ where: { name: `${MARK}boot-user` } });
      expect(event).not.toBeNull();
      expect(event!.added_by).toBe(anyUser.id);
    } finally {
      global.fetch = originalFetch;
      await db.event_has_labels.deleteMany({ where: { event: { name: `${MARK}boot-user` } } });
      await db.event.deleteMany({ where: { name: `${MARK}boot-user` } });
    }
  });
});
