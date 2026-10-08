import type { Context } from '../context.js';
import { isAtLeastEditor } from '../auth/appUsers.js';
import { normalizeGame } from './mappers.js';
// `normalizeUser` (role enum + image mapping) lives in user.ts. The dependency
// goes one way on purpose: this module imports user.ts, never the other way
// round, so the two never form an import cycle.
import { normalizeUser } from './user.js';

/**
 * One search engine for every list in CSLD — games (including their authors and
 * groups), people, events and groups.
 *
 * Why the matching lives in TypeScript instead of SQL:
 *
 * - The database can match case-insensitively (`contains`, `mode: 'insensitive'`)
 *   but not *diacritics*-insensitively, and CSLD is a Czech/Slovak database:
 *   ~72 % of the people, 63 % of the games and 64 % of the events carry a
 *   diacritic in their name. Typing `novak` used to find 2 of the 6 Nováks in
 *   production, and every one of the three examples the search page itself
 *   prints returned nothing. Folding accents needs a character map, not a
 *   database extension.
 * - `unaccent`/`pg_trgm` are extensions on a database this project cannot
 *   migrate from code (the deploy runs `prisma db push`, never a migration), so
 *   the engine must not depend on them.
 * - The catalog already ranks in memory for exactly this reason
 *   (`RECOMMENDED_CANDIDATE_LIMIT`) and the whole database is ~1.5k games,
 *   2.7k events and 3.2k people: one `findMany` of the searchable columns is
 *   cheaper and far easier to test (and to run in the browser-free suite) than
 *   any index machinery.
 *
 * Revisit when a table grows by an order of magnitude: move the same rules into
 * a generated `tsvector` column with a `pg_trgm` index and keep this scoring.
 */

/** Shortest accepted query. One letter selected arbitrary rows — the whole
 *  address book for `""` — and nobody searches by a single character on purpose.
 *  Applied to the whole query, not to its words: the documented example `D L B`
 *  is valid and its one-letter words are matched as prefixes. */
export const MIN_QUERY_LENGTH = 2;

/** More words than this stop narrowing anything and only cost time. */
export const MAX_QUERY_TOKENS = 6;

/** Upper bound on the rows loaded for one search; guards a runaway scan. */
export const MAX_SEARCH_CANDIDATES = 20000;

export const SCORE_EXACT_TITLE = 4;
export const SCORE_TITLE_START = 3;
export const SCORE_WORD_START = 2;
export const SCORE_SUBSTRING = 1;

// ── Folding (diacritics + case) ───────────────────────────

/**
 * Czech and Slovak letters with their ASCII counterpart. Deliberately a plain
 * character map: the web build parses this file with Babel, which rejects
 * Unicode property escapes (`\p{M}`) even though jest accepts them.
 */
const FOLD_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['á', 'a'], ['ä', 'a'], ['à', 'a'], ['â', 'a'], ['ã', 'a'], ['å', 'a'],
  ['č', 'c'], ['ç', 'c'], ['ć', 'c'],
  ['ď', 'd'],
  ['é', 'e'], ['ě', 'e'], ['è', 'e'], ['ë', 'e'], ['ê', 'e'], ['ę', 'e'],
  ['í', 'i'], ['ì', 'i'], ['î', 'i'], ['ï', 'i'], ['ı', 'i'],
  ['ľ', 'l'], ['ĺ', 'l'], ['ł', 'l'],
  ['ň', 'n'], ['ñ', 'n'], ['ń', 'n'],
  ['ó', 'o'], ['ô', 'o'], ['ö', 'o'], ['õ', 'o'], ['ò', 'o'], ['ø', 'o'],
  ['ř', 'r'], ['ŕ', 'r'],
  ['š', 's'], ['ś', 's'], ['ş', 's'],
  ['ť', 't'], ['ţ', 't'],
  ['ú', 'u'], ['ů', 'u'], ['ù', 'u'], ['û', 'u'], ['ü', 'u'],
  ['ý', 'y'], ['ÿ', 'y'],
  ['ž', 'z'], ['ź', 'z'], ['ż', 'z'],
];

const FOLD_MAP: { [letter: string]: string } = Object.fromEntries(FOLD_PAIRS);
const FOLD_PATTERN = new RegExp(`[${FOLD_PAIRS.map(([from]) => from).join('')}]`, 'g');

/** Lowercase and strip the Czech/Slovak diacritics: `Novák` → `novak`. */
export function foldSearchText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(FOLD_PATTERN, (letter) => FOLD_MAP[letter] ?? letter);
}

/** Folded words of a text — what a query word is matched against. */
export function searchWords(value: string | null | undefined): string[] {
  return foldSearchText(value)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/**
 * Words of the query. An empty result means "do not search" (too short), which
 * every caller has to treat as "no matches", never as "match everything".
 */
export function tokenizeSearchQuery(query: string | null | undefined): string[] {
  const trimmed = (query ?? '').trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of searchWords(trimmed)) {
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= MAX_QUERY_TOKENS) break;
  }
  return tokens;
}

// ── Matching ─────────────────────────────────────────────

export interface SearchCandidate {
  readonly id: number;
  /** The title an exact match is measured against (`De la Bête`, `Jozef Novák`). */
  readonly title?: string | null;
  /** Every other text a query word may match: nickname, city, author, place. */
  readonly extra?: ReadonlyArray<string | null | undefined>;
  /** Secondary order inside one score, higher first (rating, date of the event). */
  readonly rank?: number;
}

export interface SearchMatch<T extends SearchCandidate = SearchCandidate> {
  readonly candidate: T;
  readonly id: number;
  readonly score: number;
  /** The words matched in the order they were written — the documented rule. */
  readonly inOrder: boolean;
}

function normalizedTitle(candidate: SearchCandidate): string {
  return foldSearchText(candidate.title).trim().replace(/\s+/g, ' ');
}

function candidateWords(candidate: SearchCandidate): string[] {
  const words = searchWords(candidate.title);
  (candidate.extra ?? []).forEach((value) => words.push(...searchWords(value)));
  return words;
}

/**
 * Score one row against the words of the query, or `null` when it does not
 * match at all. Every word has to be found — `novak jozef` finds `Jozef Novák`
 * while `Jozef` alone only finds everybody called Jozef.
 *
 * A word matches at the start of a word in the title (the rule the search page
 * has always documented) or, as the last resort, inside a word.
 */
export function matchCandidate(
  tokens: readonly string[],
  foldedQuery: string,
  candidate: SearchCandidate,
): { score: number; inOrder: boolean } | null {
  if (tokens.length === 0) return null;

  const words = candidateWords(candidate);
  if (words.length === 0) return null;

  let wordStarts = 0;
  let inOrder = true;
  let previousIndex = -1;

  for (const token of tokens) {
    const index = words.findIndex((word) => word.startsWith(token));
    if (index < 0) {
      if (!words.some((word) => word.includes(token))) return null;
      inOrder = false;
      continue;
    }
    wordStarts += 1;
    if (index <= previousIndex) inOrder = false;
    previousIndex = index;
  }

  const title = normalizedTitle(candidate);
  let score: number;
  if (title === foldedQuery) score = SCORE_EXACT_TITLE;
  else if (title.startsWith(foldedQuery)) score = SCORE_TITLE_START;
  else if (wordStarts === tokens.length) score = SCORE_WORD_START;
  else score = SCORE_SUBSTRING;

  return { score, inOrder };
}

/**
 * Every match for a query, best first: exact title, title prefix, all words at
 * a word start, then the rest. `inOrder` breaks ties (the words were written in
 * the order they appear), then the caller's `tiebreak`, then the id so the order
 * never depends on the database.
 */
export function searchCandidates<T extends SearchCandidate>(
  candidates: readonly T[],
  query: string | null | undefined,
  tiebreak?: (a: T, b: T) => number,
): SearchMatch<T>[] {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return [];

  const foldedQuery = tokens.join(' ');
  const matches: SearchMatch<T>[] = [];
  for (const candidate of candidates) {
    const result = matchCandidate(tokens, foldedQuery, candidate);
    if (!result) continue;
    matches.push({ candidate, id: candidate.id, score: result.score, inOrder: result.inOrder });
  }

  const compare =
    tiebreak ??
    ((a: T, b: T) => (b.rank ?? 0) - (a.rank ?? 0) || (a.title ?? '').localeCompare(b.title ?? '', 'cs'));

  return matches.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.inOrder) - Number(a.inOrder) ||
      compare(a.candidate, b.candidate) ||
      a.id - b.id,
  );
}

// ── "Mysleli jste…?" (typo tolerance) ────────────────────

/** Damerau-free Levenshtein over two short words. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** Where a suggestion's words are cut, keeping the original spelling of each. */
const WORD_SEPARATOR = /[\s,.;:!?()"'„“”–—-]+/;

export interface VocabularyEntry {
  readonly word: string;
  count: number;
}

/** How many typos a word of this length may carry. */
export function allowedEdits(length: number): number {
  return length <= 4 ? 1 : 2;
}

/**
 * The replaced query to offer when nothing matched, or `null` when nothing could
 * be corrected (then the page shows "nothing found" and no guess). Words are
 * returned as they appear in the data (`beta` → `Bête`), so accepting the
 * suggestion searches for something that really exists.
 */
export function suggestQuery(
  query: string | null | undefined,
  candidates: readonly SearchCandidate[],
): string | null {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return null;

  // Folded word → how it is really written, the most frequent form wins.
  const vocabulary = new Map<string, VocabularyEntry>();
  const remember = (value: string | null | undefined) => {
    const raw = (value ?? '').trim();
    if (!raw) return;
    raw.split(WORD_SEPARATOR).forEach((word) => {
      const folded = foldSearchText(word);
      if (folded.length < 3) return;
      const existing = vocabulary.get(folded);
      if (existing) existing.count += 1;
      else vocabulary.set(folded, { word, count: 1 });
    });
  };

  candidates.forEach((candidate) => {
    remember(candidate.title);
    (candidate.extra ?? []).forEach(remember);
  });
  if (vocabulary.size === 0) return null;

  const words = Array.from(vocabulary.keys());
  let corrected = false;
  const parts = tokens.map((token) => {
    if (words.some((word) => word.startsWith(token))) return token;

    let bestFold: string | null = null;
    let bestEntry: VocabularyEntry | null = null;
    for (const word of words) {
      const distance = editDistance(token, word);
      if (distance === 0 || distance > allowedEdits(token.length)) continue;
      const entry = vocabulary.get(word)!;
      if (bestEntry && bestFold) {
        const bestDistance = editDistance(token, bestFold);
        if (bestDistance < distance || (bestDistance === distance && entry.count <= bestEntry.count)) continue;
      }
      bestFold = word;
      bestEntry = entry;
    }
    // A word nobody is close to stays as it is; it must not swallow the words
    // that *can* be corrected ("hell on weels" → "hell on Wheels").
    if (!bestEntry) return token;
    corrected = true;
    return bestEntry.word;
  });

  if (!corrected) return null;
  return parts.join(' ');
}

// ── Games ────────────────────────────────────────────────

/**
 * Games matched on their name, their authors and their group authors — a
 * person looking for "hry od Nováka" should not have to know that the game
 * search never looked at the author column.
 */
const GAME_SEARCH_SELECT = {
  id: true,
  name: true,
  total_rating: true,
  csld_game_has_author: { select: { csld_csld_user: { select: { name: true, nickname: true } } } },
  csld_game_has_group: { select: { csld_csld_group: { select: { name: true } } } },
} as const;

const GAME_LIST_INCLUDE = { csld_game_has_label: { include: { csld_label: true } } } as const;

async function gameCandidates(ctx: Context): Promise<SearchCandidate[]> {
  const rows: any[] = await ctx.db.csld_game.findMany({
    where: { deleted: false },
    select: GAME_SEARCH_SELECT,
    take: MAX_SEARCH_CANDIDATES,
  } as any);

  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    extra: [
      ...(row.csld_game_has_author ?? []).flatMap((link: any) => [
        link.csld_csld_user?.name,
        link.csld_csld_user?.nickname,
      ]),
      ...(row.csld_game_has_group ?? []).map((link: any) => link.csld_csld_group?.name),
    ],
    rank: row.total_rating ?? 0,
  }));
}

/**
 * Ids of the games matching a text query, best first. `null` means the query is
 * too short to narrow anything down and the caller should ignore it (the
 * catalog keeps it as one filter among many).
 */
export async function gameIdsForQuery(
  ctx: Context,
  query: string | null | undefined,
): Promise<number[] | null> {
  if (tokenizeSearchQuery(query).length === 0) return null;
  const matches = searchCandidates(await gameCandidates(ctx), query);
  return matches.map((match) => match.id);
}

export interface SearchPage {
  readonly ids: number[];
  readonly totalAmount: number;
  /** Offered when the query found nothing (`Mysleli jste: …`). */
  readonly suggestion: string | null;
}

async function gamesPage(ctx: Context, query: string, offset: number, limit: number): Promise<SearchPage> {
  const candidates = await gameCandidates(ctx);
  const matches = searchCandidates(candidates, query);
  return {
    ids: matches.slice(offset, offset + limit).map((match) => match.id),
    totalAmount: matches.length,
    suggestion: matches.length ? null : suggestQuery(query, candidates),
  };
}

export async function fetchGamesByIds(ctx: Context, ids: readonly number[]) {
  if (ids.length === 0) return [];
  const rows: any[] = await ctx.db.csld_game.findMany({
    where: { id: { in: [...ids] } },
    include: GAME_LIST_INCLUDE as any,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row) => Boolean(row))
    .map((row) => normalizeGame(row));
}

// ── People ───────────────────────────────────────────────

/**
 * Public profile fields only: `email` is the account identifier (it is how you
 * sign in and how a password is recovered) and is never searched. `address` is
 * the column behind the public `city`.
 */
const USER_SEARCH_SELECT = { id: true, name: true, nickname: true, address: true } as const;

async function userCandidates(ctx: Context): Promise<SearchCandidate[]> {
  const rows: any[] = await ctx.db.csld_csld_user.findMany({
    select: USER_SEARCH_SELECT,
    take: MAX_SEARCH_CANDIDATES,
  } as any);

  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    extra: [row.nickname, row.address],
    rank: 0,
  }));
}

async function usersPage(ctx: Context, query: string, offset: number, limit: number): Promise<SearchPage> {
  const candidates = await userCandidates(ctx);
  const matches = searchCandidates(candidates, query);
  return {
    ids: matches.slice(offset, offset + limit).map((match) => match.id),
    totalAmount: matches.length,
    suggestion: matches.length ? null : suggestQuery(query, candidates),
  };
}

export async function fetchUsersByIds(ctx: Context, ids: readonly number[]) {
  if (ids.length === 0) return [];
  const rows: any[] = await ctx.db.csld_csld_user.findMany({
    where: { id: { in: [...ids] } },
    include: { csld_image: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const includeDeleted = isAtLeastEditor(ctx);
  return ids
    .map((id) => byId.get(id))
    .filter((row) => Boolean(row))
    .map((row) => normalizeUser(row, includeDeleted));
}

// ── Events ───────────────────────────────────────────────

/**
 * Events matched on their name and their place. The description is left out on
 * purpose: it is a whole program text (hundreds of characters per row, 2 733
 * rows), so loading it on every keystroke of the header search would cost
 * megabytes per query and would return events whose *program* mentions the word
 * the visitor cannot see. A description search belongs behind an explicit
 * "hledat i v popisu" switch, not into the default.
 */
const EVENT_SEARCH_SELECT = { id: true, name: true, loc: true, from: true } as const;

const EVENT_SEARCH_INCLUDE = {
  event_has_labels: { include: { csld_label: true } },
  csld_game_has_event: { include: { csld_game: true } },
} as const;

/** Shared shape of an event row, used by the calendar and the search alike. */
export function mapEventRow(event: any, ctx: Context) {
  return {
    ...event,
    amountOfPlayers: event.amountofplayers,
    location:
      event.latitude != null || event.longitude != null
        ? { lattitude: event.latitude, longtitude: event.longitude }
        : null,
    labels: (event.event_has_labels ?? []).map((j: any) => j.csld_label).filter(Boolean),
    // A game deleted on its detail page must not show up as played at the event
    // either; editors and admins keep seeing it (see `gameByIdResolver`).
    games: (event.csld_game_has_event ?? [])
      .map((j: any) => j.csld_game)
      .filter((g: any) => g && (isAtLeastEditor(ctx) || !g.deleted))
      .map((g: any) => normalizeGame(g)),
  };
}

async function eventCandidates(ctx: Context, from?: string | null, to?: string | null): Promise<SearchCandidate[]> {
  const where: any = { deleted: false };
  if (from) where.from = { gte: new Date(from) };
  if (to) where.to = { lte: new Date(to) };

  const rows: any[] = await ctx.db.event.findMany({ where, select: EVENT_SEARCH_SELECT, take: MAX_SEARCH_CANDIDATES } as any);

  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    extra: [row.loc, row.description],
    // Upcoming first inside one score, the way the calendar lists them.
    rank: row.from ? new Date(row.from).getTime() : 0,
  }));
}

async function eventsPage(
  ctx: Context,
  query: string,
  offset: number,
  limit: number,
  from?: string | null,
  to?: string | null,
): Promise<SearchPage> {
  const candidates = await eventCandidates(ctx, from, to);
  const matches = searchCandidates(candidates, query);
  return {
    ids: matches.slice(offset, offset + limit).map((match) => match.id),
    totalAmount: matches.length,
    suggestion: matches.length ? null : suggestQuery(query, candidates),
  };
}

/**
 * Ids of the events matching a text query, best first. `null` when the query is
 * too short to filter on — the calendar keeps its other filters then.
 */
export async function eventIdsForQuery(
  ctx: Context,
  query: string | null | undefined,
  from?: string | null,
  to?: string | null,
): Promise<number[] | null> {
  if (tokenizeSearchQuery(query).length === 0) return null;
  const matches = searchCandidates(await eventCandidates(ctx, from, to), query);
  return matches.map((match) => match.id);
}

export async function fetchEventsByIds(ctx: Context, ids: readonly number[]) {
  if (ids.length === 0) return [];
  const rows: any[] = await ctx.db.event.findMany({
    where: { id: { in: [...ids] } },
    include: EVENT_SEARCH_INCLUDE as any,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row) => Boolean(row))
    .map((row) => mapEventRow(row, ctx));
}

// ── Groups ───────────────────────────────────────────────

async function groupCandidates(ctx: Context): Promise<SearchCandidate[]> {
  const rows: any[] = await ctx.db.csld_csld_group.findMany({
    select: { id: true, name: true },
    take: MAX_SEARCH_CANDIDATES,
  } as any);

  return rows.map((row) => ({ id: row.id, title: row.name, rank: 0 }));
}

async function groupsPage(ctx: Context, query: string, offset: number, limit: number): Promise<SearchPage> {
  const candidates = await groupCandidates(ctx);
  const matches = searchCandidates(candidates, query);
  return {
    ids: matches.slice(offset, offset + limit).map((match) => match.id),
    totalAmount: matches.length,
    suggestion: matches.length ? null : suggestQuery(query, candidates),
  };
}

export async function fetchGroupsByIds(ctx: Context, ids: readonly number[]) {
  if (ids.length === 0) return [];
  const rows: any[] = await ctx.db.csld_csld_group.findMany({
    where: { id: { in: [...ids] } },
    include: { csld_game_has_group: { include: { csld_game: true } } },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row) => Boolean(row))
    .map((row) => ({
      ...row,
      authorsOf: (row.csld_game_has_group ?? [])
        .map((j: any) => j.csld_game)
        .filter(Boolean)
        .map((g: any) => normalizeGame(g)),
    }));
}

// ── Resolvers ────────────────────────────────────────────

const clampLimit = (limit: number | null | undefined, fallback: number, max: number): number =>
  Math.min(Math.max(1, Math.trunc(limit ?? fallback)), max);

/** `query { games { byQuery(page) } }` — ranked, with an honest total. */
export async function gamesSearchPage(ctx: Context, query: string, offset: number, limit: number): Promise<SearchPage> {
  return gamesPage(ctx, query, Math.max(0, offset), Math.max(0, limit));
}

/** `query { usersByQueryWithTotal }` — the people tab of the search page. */
export async function usersSearchPage(ctx: Context, query: string, offset: number, limit: number): Promise<SearchPage> {
  return usersPage(ctx, query, Math.max(0, offset), Math.max(0, limit));
}

/** `query { eventsByQuery }` — the events tab of the search page. */
export async function eventsSearchPage(
  ctx: Context,
  query: string,
  offset: number,
  limit: number,
  from?: string | null,
  to?: string | null,
): Promise<SearchPage> {
  return eventsPage(ctx, query, Math.max(0, offset), Math.max(0, limit), from, to);
}

/** `query { groupsByQuery }` — the group autocomplete and the unified search. */
export async function groupsSearchPage(ctx: Context, query: string, offset: number, limit: number): Promise<SearchPage> {
  return groupsPage(ctx, query, Math.max(0, offset), Math.max(0, limit));
}

/**
 * `usersByQueryWithTotal` — the people tab of the search page. `usersByQuery`
 * (user.ts) stays a plain list for the author autocomplete of the game form,
 * which has no room for a total.
 */
export async function usersByQueryWithTotalResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const page = await usersSearchPage(ctx, args.query, args.offset ?? 0, args.limit ?? 25);
  return {
    users: await fetchUsersByIds(ctx, page.ids),
    totalAmount: page.totalAmount,
    suggestion: page.suggestion,
  };
}

/**
 * `usersByQuery` — the query behind the people tab and the author autocomplete
 * of the game form. The emails are gone from the result on purpose: they are
 * account data, see `resolvers/index.ts` and `profileBioAndEmail.test.ts`.
 *
 * It lives here (not in `user.ts`) because it needs the engine, and this module
 * is the one that imports `user.ts` — see the note next to the import.
 */
export async function usersByQueryResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const page = await usersSearchPage(ctx, args.query, args.offset ?? 0, args.limit ?? 25);
  return fetchUsersByIds(ctx, page.ids);
}

export async function eventsByQueryResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number; from?: string; to?: string },
  ctx: Context,
) {
  const page = await eventsSearchPage(
    ctx,
    args.query,
    args.offset ?? 0,
    args.limit ?? 25,
    args.from,
    args.to,
  );
  return {
    events: await fetchEventsByIds(ctx, page.ids),
    totalAmount: page.totalAmount,
    suggestion: page.suggestion,
  };
}

export interface SearchResultsPayload {
  games: any[];
  users: any[];
  events: any[];
  groups: any[];
  totalGames: number;
  totalUsers: number;
  totalEvents: number;
  totalGroups: number;
  suggestion: string | null;
}

/**
 * `query { search }` — one round trip for the header dropdown, which used to
 * look at games only (typing a person's name there answered "nothing found"
 * while the people tab one click away knew them).
 */
export async function searchResolver(
  _parent: unknown,
  args: { query: string; limit?: number },
  ctx: Context,
): Promise<SearchResultsPayload> {
  const limit = clampLimit(args.limit, 5, 20);
  const [games, users, events, groups] = await Promise.all([
    gamesPage(ctx, args.query, 0, limit),
    usersPage(ctx, args.query, 0, limit),
    eventsPage(ctx, args.query, 0, limit),
    groupsPage(ctx, args.query, 0, limit),
  ]);

  const [gameRows, userRows, eventRows, groupRows] = await Promise.all([
    fetchGamesByIds(ctx, games.ids),
    fetchUsersByIds(ctx, users.ids),
    fetchEventsByIds(ctx, events.ids),
    fetchGroupsByIds(ctx, groups.ids),
  ]);

  // A guess is only offered when *nothing* matched: the per-kind pages say the
  // same (`matches.length ? null : …`), and a visitor who already sees an event
  // in the list must not be told "did you mean…?" about the list they are
  // looking at.
  const totalAmount =
    games.totalAmount + users.totalAmount + events.totalAmount + groups.totalAmount;

  return {
    games: gameRows,
    users: userRows,
    events: eventRows,
    groups: groupRows,
    totalGames: games.totalAmount,
    totalUsers: users.totalAmount,
    totalEvents: events.totalAmount,
    totalGroups: groups.totalAmount,
    suggestion:
      totalAmount === 0
        ? games.suggestion ?? users.suggestion ?? events.suggestion ?? groups.suggestion
        : null,
  };
}
