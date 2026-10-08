import { format } from 'date-fns'
import { parseDateTime } from '../../utils/dateUtils'
import { matchTextQuery } from '../../utils/textUtils'
import { GameCatalogOrder } from '../../graphql/__generated__/typescript-operations'
import { CatalogState, CATALOG_ORDERS, catalogStateToQuery, parseCatalogState } from '../Catalog/catalogState'

/**
 * The shapes the search page works with. They are structural on purpose: the
 * helpers below are unit-tested without a GraphQL document, and the rows pass
 * their fragments in.
 */
export interface GameRowData {
    readonly id: string
    readonly name?: string | null
    readonly year?: number | null
    readonly amountOfComments: number
    readonly amountOfRatings: number
    readonly averageRating: number
    readonly totalRating: number
    readonly labels: Array<{ readonly id: string; readonly name?: string | null }>
    readonly authors?: Array<{ readonly id: string; readonly name: string }> | null
    readonly groupAuthor?: Array<{ readonly id: string; readonly name?: string | null }> | null
}

export interface PersonRowData {
    readonly id: string
    readonly name: string
    readonly nickname?: string | null
    readonly birthDate?: string | null
    readonly city?: string | null
    readonly image?: { readonly id: string } | null
}

export interface EventRowData {
    readonly id: string
    readonly name?: string | null
    readonly from?: string | null
    readonly to?: string | null
    readonly loc?: string | null
    readonly web?: string | null
    readonly registrationUrl?: string | null
    readonly registrationOpen: boolean
    readonly amountOfPlayers?: number | null
    readonly labels?: Array<{ readonly id: string; readonly name?: string | null }> | null
    readonly games?: Array<{ readonly id: string; readonly name?: string | null }> | null
}

export interface GroupRowData {
    readonly id: string
    readonly name?: string | null
    readonly authorsOf: Array<{ readonly id: string }>
}

// ── Types of result ──────────────────────────────────────

/**
 * Four kinds of result share one page: the type is a filter, never a tab that
 * hides the other three. The order is the order of the rows and chips.
 */
export const SEARCH_TYPES = ['games', 'users', 'events', 'groups'] as const

export type SearchType = (typeof SEARCH_TYPES)[number]

export const DEFAULT_SEARCH_TYPE: SearchType = 'games'

/**
 * Czech slugs in the URL (`?typ=udalosti`). The page is Czech-only, a Czech
 * slug in a shared link reads better, and the two letter `t=` of the tab era
 * carried no meaning at all.
 */
export const TYPE_PARAM: Record<SearchType, string> = {
    games: 'hry',
    users: 'lide',
    events: 'udalosti',
    groups: 'skupiny',
}

export const isSearchType = (value: unknown): value is SearchType =>
    typeof value === 'string' && (SEARCH_TYPES as readonly string[]).includes(value)

/** Reads `?typ=`; the English value and the legacy `t=` still resolve, so old links keep working. */
export const searchTypeFromParam = (value: unknown): SearchType | undefined => {
    if (Array.isArray(value)) {
        return searchTypeFromParam(value[0])
    }
    const bySlug = SEARCH_TYPES.find(type => TYPE_PARAM[type] === value)
    return bySlug ?? (isSearchType(value) ? value : undefined)
}

export interface SearchParams {
    readonly q?: string
    readonly typ?: string
    // Next.js' ParsedUrlQueryInput requires the index signature
    readonly [key: string]: string | undefined
}

export const searchQueryParams = (query: string, type?: SearchType | null): SearchParams => {
    const trimmed = query.trim()
    return {
        ...(trimmed ? { q: trimmed } : {}),
        ...(type ? { typ: TYPE_PARAM[type] } : {}),
    }
}

// ── The games section: the catalog's own facets and orders ────────────────

/**
 * The games section runs the catalog's machinery — the facets (labels with their
 * counts, durations, the year range), the ranges and the orders are all solved
 * there, and `filter.query` goes through the same search engine, so the games
 * are the ones the old tab showed. Its default order is the engine's own
 * ranking, `Relevance`, not the catalog's `Recommended`: on a search page the
 * best match leads (a game whose name *is* the query can have no ratings at all).
 */
export const SEARCH_GAMES_DEFAULT_ORDER = GameCatalogOrder.Relevance

/**
 * The catalog state of the games section, read from the same URL as `q` and
 * `typ` (so a filtered list can be sent as a link). Only an explicit `order`
 * in the URL beats the search default.
 */
export const searchGamesState = (urlQuery: Parameters<typeof parseCatalogState>[0]): CatalogState => {
    const parsed = parseCatalogState(urlQuery)
    const order = urlQuery.order
    // Only an order the catalog knows counts as "asked for"; anything else (a typo,
    // a stale link) leaves the search default alone.
    const asked = typeof order === 'string' && (CATALOG_ORDERS as readonly string[]).includes(order)

    return asked ? parsed : { ...parsed, order: SEARCH_GAMES_DEFAULT_ORDER }
}

/**
 * Everything that belongs in the URL of the page: the query, the picked kind and
 * — only for games, which are the kind with facets — the catalog parameters. The
 * text lives once (`q`), so the facet state carries none of its own, and the
 * search default order is left out to keep the common URL short.
 */
export const searchPageQuery = (
    query: string,
    type?: SearchType | null,
    gamesState?: CatalogState,
): SearchParams => {
    const params = searchQueryParams(query, type)

    if (type === 'games' && gamesState) {
        const catalogParams = catalogStateToQuery({ ...gamesState, query: '' })
        if (gamesState.order === SEARCH_GAMES_DEFAULT_ORDER) {
            delete catalogParams.order
        }
        Object.assign(params, catalogParams)
    }

    return params
}

// ── The one type that can never be counted from a page of rows ────────────

/** `1.–25. z 121` — the pager of the tab era showed bare page numbers. */
export const pageRange = (totalAmount: number, offset: number, pageSize: number): { from: number; to: number } | undefined => {
    if (totalAmount <= 0) return undefined
    return { from: offset + 1, to: Math.min(offset + pageSize, totalAmount) }
}

// ── Best matches block ───────────────────────────────────

export interface BestMatch<T> {
    readonly type: SearchType
    readonly item: T
}

/**
 * Three best of every kind, interleaved (first of each kind, then the second,
 * then the third). A single ranking over all kinds would hand the first screen
 * to the kind with the most rows — measured on production, a query of `larp`
 * puts 24 events and no game in the first page, and `novak` (a person's name)
 * puts 25 games before the first person.
 */
export const bestMatches = <T>(
    perType: Partial<Record<SearchType, readonly T[] | null | undefined>>,
    count = 3,
): Array<BestMatch<T>> => {
    const lists = SEARCH_TYPES.map(type => ({ type, items: perType[type] ?? [] }))
    const out: Array<BestMatch<T>> = []
    for (let rank = 0; rank < count; rank++) {
        lists.forEach(({ type, items }) => {
            const item = items[rank]
            if (item) out.push({ type, item })
        })
    }
    return out
}

// ── Why a row is in the list ─────────────────────────────

export interface MatchReason {
    readonly kind: 'author' | 'group' | 'nickname' | 'city'
    readonly name: string
}

/**
 * The engine matches games on their name, their authors and their groups, but
 * the row only ever shows the name — 55 of the 121 games a `larp` query returns
 * have no `larp` in the name (a group called *Larpard*, *Moravian LARP*), and
 * for `novak` it is 37 of 37 (an author called Jan Novák). Without this the
 * list looks random.
 */
export const gameMatchReason = (game: GameRowData, query?: string | null): MatchReason | undefined => {
    if (matchTextQuery(game.name, query)) return undefined

    const author = (game.authors ?? []).find(candidate => matchTextQuery([candidate.name], query))
    if (author) {
        return { kind: 'author', name: author.name }
    }

    const group = (game.groupAuthor ?? []).find(candidate => matchTextQuery(candidate.name, query))
    return group ? { kind: 'group', name: group.name ?? '' } : undefined
}

/** People are matched on their name, their nickname and their city (`address`). */
export const personMatchReason = (person: PersonRowData, query?: string | null): MatchReason | undefined => {
    if (matchTextQuery(person.name, query)) return undefined
    if (person.nickname && matchTextQuery(person.nickname, query)) return { kind: 'nickname', name: person.nickname }
    if (person.city && matchTextQuery(person.city, query)) return { kind: 'city', name: person.city }
    return undefined
}

// ── Rows ─────────────────────────────────────────────────

/** At most three labels and a count of the rest — one long line per row. */
export const labelsToShow = (
    labels: ReadonlyArray<{ readonly name?: string | null }> | null | undefined,
    max = 3,
): { shown: string[]; more: number } => {
    const names = (labels ?? []).map(label => label.name ?? '').filter(name => name.length > 0)
    return { shown: names.slice(0, max), more: Math.max(0, names.length - max) }
}

/** `28. 4.–30. 4. 2022` / `9. 4. 2027` — the search list has no day headings. */
export const eventDateLabel = (from?: string | null, to?: string | null): string => {
    const start = parseDateTime(from)
    if (!start) return ''
    const end = parseDateTime(to)
    if (!end || format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) return format(start, 'd. M. yyyy')
    if (start.getFullYear() !== end.getFullYear()) return `${format(start, 'd. M. yyyy')}–${format(end, 'd. M. yyyy')}`
    if (start.getMonth() !== end.getMonth()) return `${format(start, 'd. M.')}–${format(end, 'd. M. yyyy')}`
    return `${format(start, 'd.')}–${format(end, 'd. M. yyyy')}`
}

export const isUpcoming = (event: Pick<EventRowData, 'from' | 'to'>, today = new Date()): boolean => {
    const end = parseDateTime(event.to) ?? parseDateTime(event.from)
    return end ? end.getTime() >= today.getTime() : false
}

/** How many events share this row's name, start and end. */
export const duplicateCount = (
    duplicates: ReadonlyArray<{ readonly eventId: string; readonly count: number }> | null | undefined,
    eventId: string,
): number => (duplicates ?? []).find(entry => entry.eventId === eventId)?.count ?? 0

/** Time window of the events list: `vše` / `nadcházející` / `archiv`. */
export type EventTimeFilter = 'all' | 'upcoming' | 'archive'

export const EVENT_TIME_FILTERS: readonly EventTimeFilter[] = ['all', 'upcoming', 'archive']

export const isEventTimeFilter = (value: unknown): value is EventTimeFilter =>
    typeof value === 'string' && (EVENT_TIME_FILTERS as readonly string[]).includes(value)

export const eventTimeRange = (filter: EventTimeFilter, now = new Date()): { from?: string; to?: string } => {
    const today = format(now, 'yyyy-MM-dd')
    if (filter === 'upcoming') return { from: today }
    if (filter === 'archive') return { to: today }
    return {}
}
