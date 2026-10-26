import * as cheerio from 'cheerio';
import type { PrismaClient } from '@prisma/client';

/**
 * Import events from larp.cz calendar.
 * 
 * Scrapes https://www.larp.cz/kalendar, parses event rows,
 * deduplicates by event NAME (matches Java behavior),
 * creates new events with the "LarpCz" label.
 */

const LARP_CZ_URL = 'https://www.larp.cz/kalendar';

/**
 * The id of the user that "owns" rows created by automated imports.
 *
 * The historical Java importer assumed user id 1 exists; on a fresh
 * database (CI, a new deployment) it does not, and the FK violation was
 * silently swallowed by the import's catch block ("imported: 0"). So: use
 * the lowest existing id, and when the database has no users at all
 * (fresh install), create the bootstrap system account first.
 */
const SYSTEM_USER_EMAIL = 'system@larpova-databaze.local';

async function systemUserId(db: PrismaClient): Promise<number> {
  const anyUser = await db.csld_csld_user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  if (anyUser) return anyUser.id;
  const created = await db.csld_csld_user.create({
    data: { password: '!', role: 2, name: 'Systém', email: SYSTEM_USER_EMAIL },
  });
  return created.id;
}

interface ParsedEvent {
  name: string;
  date: string;
  location: string;
  web: string;
}

/** Parse the calendar table's event rows; the selectors follow larp.cz's
 * markup. */
function scrapeEvents($: cheerio.CheerioAPI): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  $('.kalendar-akce').each((_i, el) => {
    const name = $(el).find('.akce-nazev a').text().trim();
    const date = $(el).find('.akce-datum').text().trim();
    const location = $(el).find('.akce-misto').text().trim();
    const web = $(el).find('.akce-nazev a').attr('href') || '';

    if (name) {
      events.push({ name, date, location, web });
    }
  });

  // Fallback: try alternative selectors
  if (events.length === 0) {
    $('tr').each((_i, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 3) {
        const name = $(cells[0]).text().trim();
        const date = $(cells[1]).text().trim();
        const location = $(cells[2]).text().trim();
        if (name && date) {
          events.push({ name, date, location, web: '' });
        }
      }
    });
  }
  return events;
}

/** The "LarpCz" label every imported event carries, created on first import. */
async function ensureLarpCzLabel(db: PrismaClient) {
  const existing = await db.csld_label.findFirst({
    where: { name: 'LarpCz' },
  });
  if (existing) return existing;
  return db.csld_label.create({
    data: {
      name: 'LarpCz',
      description: 'Události importované z larp.cz',
      is_required: false,
      is_authorized: true,
      added_by: await systemUserId(db), // system user
    },
  });
}

/** Import the not-yet-known events, deduplicated by name (matches Java
 * behavior); returns how many were created. */
async function importNewEvents(db: PrismaClient, events: readonly ParsedEvent[], larpCzLabelId: number): Promise<number> {
  let imported = 0;

  for (const parsed of events) {
    // Deduplicate by event NAME (matches Java behavior)
    const existing = await db.event.findFirst({
      where: {
        name: parsed.name,
        deleted: false,
      },
    });

    if (existing) {
      continue; // Already exists — skip
    }

    // Parse date (e.g., "1. 6. 2026")
    const fromDate = parseCzechDate(parsed.date);

    if (!fromDate) {
      console.log(`larp.cz import: skipping "${parsed.name}" — unparseable date "${parsed.date}"`);
      continue;
    }

    const from = new Date(fromDate);
    const to = new Date(fromDate);
    to.setDate(to.getDate() + 2); // Default: 2-day event

    const event = await db.event.create({
      data: {
        name: parsed.name,
        description: `Importováno z larp.cz`,
        loc: parsed.location || null,
        web: parsed.web || null,
        from,
        to,
        source: 'larp.cz',
        added_by: await systemUserId(db), // system user
        deleted: false,
      },
    });

    // Link LarpCz label
    await db.event_has_labels.create({
      data: {
        event_id: event.id,
        label_id: larpCzLabelId,
      },
    });

    imported++;
  }
  return imported;
}

export async function importLarpCzEvents(db: PrismaClient): Promise<number> {
  try {
    const html = await fetch(LARP_CZ_URL).then((r) => r.text());
    const $ = cheerio.load(html);

    const events = scrapeEvents($);

    if (events.length === 0) {
      console.log('larp.cz import: no events found (page structure may have changed)');
      return 0;
    }

    const larpCzLabel = await ensureLarpCzLabel(db);
    const imported = await importNewEvents(db, events, larpCzLabel.id);

    console.log(`larp.cz import: imported ${imported} new events (${events.length} found, ${events.length - imported} skipped)`);
    return imported;

  } catch (err) {
    console.error('larp.cz import error:', err);
    return 0;
  }
}

/**
 * Parse Czech date format like "1. 6. 2026" or "12. 11. 2025"
 */
function parseCzechDate(str: string): string | null {
  if (!str) return null;
  // Try DD. MM. YYYY
  const match = str.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/);
  if (match) {
    const [_, day, month, year] = match;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    // Validate
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return iso;
  }
  return null;
}
