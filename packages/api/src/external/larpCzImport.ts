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

interface ParsedEvent {
  name: string;
  date: string;
  location: string;
  web: string;
}

export async function importLarpCzEvents(db: PrismaClient): Promise<number> {
  try {
    const html = await fetch(LARP_CZ_URL).then((r) => r.text());
    const $ = cheerio.load(html);

    const events: ParsedEvent[] = [];

    // Parse event rows from the calendar table
    // The actual selector depends on larp.cz HTML structure
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

    if (events.length === 0) {
      console.log('larp.cz import: no events found (page structure may have changed)');
      return 0;
    }

    // Find or create the "LarpCz" label
    let larpCzLabel = await db.csld_label.findFirst({
      where: { name: 'LarpCz' },
    });

    if (!larpCzLabel) {
      larpCzLabel = await db.csld_label.create({
        data: {
          name: 'LarpCz',
          description: 'Události importované z larp.cz',
          is_required: false,
          is_authorized: true,
          added_by: 1, // system user
        },
      });
    }

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
          added_by: 1, // system user
          deleted: false,
        },
      });

      // Link LarpCz label
      await db.event_has_labels.create({
        data: {
          event_id: event.id,
          label_id: larpCzLabel!.id,
        },
      });

      imported++;
    }

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
