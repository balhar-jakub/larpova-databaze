import type { Context } from '../context.js';
import { normalizeGame } from './mappers.js';
import { isAtLeastEditor } from '../auth/appUsers.js';

/**
 * Series: recurring games (Florie, Zlenice, Bezkrálí…) grouped by a relationship,
 * not merged — each instalment keeps its own ratings, comments and play states.
 *
 * The resolvers here answer the series itself and its aggregate numbers; the
 * instalments are always served through `normalizeGame`, so a nested row can
 * never leak snake_case or a numeric role into a client.
 */

/** Visible instalments of a series for this viewer: soft-deleted games only for editors/admins. */
function instalmentsFilter(ctx: Context) {
  return isAtLeastEditor(ctx) ? {} : { deleted: false };
}

/** Load one series row with its instalments (each fully normalized). */
async function loadSeries(id: number, ctx: Context) {
  const row = await ctx.db.csld_series.findUnique({
    where: { id },
    include: {
      csld_game: {
        where: instalmentsFilter(ctx),
        orderBy: [{ year: 'asc' }, { id: 'asc' }],
        include: {
          csld_game_has_label: { include: { csld_label: true } },
          csld_game_has_author: { include: { csld_csld_user: true } },
          csld_game_has_group: { include: { csld_csld_group: true } },
          csld_game_has_event: { include: { event: true } },
        },
      },
    },
  });
  if (!row || (row.deleted && !isAtLeastEditor(ctx))) return null;
  return normalizeSeries(row);
}

/**
 * Normalize a Prisma series row (snake_case) to the GraphQL shape. Aggregates
 * are summed over the loaded instalments, so the numbers always agree with the
 * list the same query returns — one source, one meaning.
 */
export function normalizeSeries(row: any) {
  if (!row) return null;
  const games = (row.csld_game ?? []).map((g: any) => normalizeGame(g)).filter(Boolean);
  const years = games.map((g: any) => g?.year).filter((y: any): y is number => typeof y === 'number');
  return {
    ...row,
    games,
    amountOfGames: games.length,
    amountOfRatings: games.reduce((sum: number, g: any) => sum + (g?.amountOfRatings ?? 0), 0),
    amountOfPlayed: games.reduce((sum: number, g: any) => sum + (g?.amountOfPlayed ?? 0), 0),
    amountOfComments: games.reduce((sum: number, g: any) => sum + (g?.amountOfComments ?? 0), 0),
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    added: row.added instanceof Date ? row.added.toISOString() : row.added,
  };
}

// ── Query resolvers ──────────────────────────────────────

export async function seriesByIdResolver(
  _parent: unknown,
  args: { seriesId: string },
  ctx: Context,
) {
  const id = parseInt(args.seriesId, 10);
  if (isNaN(id)) return null;
  return loadSeries(id, ctx);
}

/**
 * Series picker of the game edit form: substring match on the name, diacritics
 * and case as they are stored (the search engine's normalization does not apply
 * here — the list is small and the editor can see the real names).
 */
export async function seriesByQueryResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const rows = await ctx.db.csld_series.findMany({
    where: {
      deleted: false,
      ...(args.query?.trim()
        ? { name: { contains: args.query.trim(), mode: 'insensitive' } }
        : {}),
    },
    orderBy: { name: 'asc' },
    skip: args.offset ?? 0,
    take: Math.min(args.limit ?? 20, 50),
    include: {
      csld_game: {
        where: instalmentsFilter(ctx),
        orderBy: [{ year: 'asc' }, { id: 'asc' }],
        include: {
          csld_game_has_label: { include: { csld_label: true } },
          csld_game_has_author: { include: { csld_csld_user: true } },
          csld_game_has_group: { include: { csld_csld_group: true } },
          csld_game_has_event: { include: { event: true } },
        },
      },
    },
  });
  return rows.map((r: any) => normalizeSeries(r));
}

/** `Game.series` — the instalment's own series, without loading it a second time. */
export async function gameSeriesResolver(parent: any, _args: unknown, ctx: Context) {
  const seriesId = parent?.series_id ?? parent?.seriesId ?? null;
  if (!seriesId) return null;
  const id = typeof seriesId === 'string' ? parseInt(seriesId, 10) : seriesId;
  if (isNaN(id)) return null;
  return loadSeries(id, ctx);
}
