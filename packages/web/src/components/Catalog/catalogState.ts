import { ParsedUrlQuery } from 'querystring'
import {
    GameCatalogFilter,
    GameCatalogOrder,
} from '../../graphql/__generated__/typescript-operations'
import { MIN_NUM_RATINGS, RECOMMENDED_FROM } from '../../utils/ratingUtils'

/**
 * State of the games catalog (the page at /games).
 *
 * The whole state lives in the URL: every filter, the order and the page size
 * have a short query parameter, so a filtered list can be bookmarked or sent to
 * somebody else, and the server renders the very same list the client shows.
 * Old `/games?ladderType=Best` links keep working — see LEGACY_LADDER_ORDER.
 */

export type CatalogLabelMode = 'all' | 'any'

export interface CatalogState {
    readonly order: GameCatalogOrder
    readonly size: number
    readonly labelMode: CatalogLabelMode
    readonly labels: readonly string[]
    readonly durations: readonly string[]
    readonly yearFrom?: number
    readonly yearTo?: number
    readonly playersFrom?: number
    readonly playersTo?: number
    readonly minRating?: number
    readonly minRatings?: number
    readonly withComments: boolean
    readonly withImage: boolean
    readonly addedWithinDays?: number
    readonly query?: string
    /**
     * Only the games this author wrote — the "hry od X" link of a search result
     * or of a game detail. The name rides along in the URL (`autorn`) so the
     * filter chip can say whose games these are without another request.
     */
    readonly author?: number
    readonly authorName?: string
}

export const DEFAULT_CATALOG_SIZE = 24
export const DEFAULT_CATALOG_ORDER = GameCatalogOrder.Recommended

/** Mirrors DURATION_KEYS in packages/api/src/resolvers/gameCatalog.ts. */
export const DURATION_KEYS = ['short', 'day', 'weekend', 'long'] as const
export type DurationKey = (typeof DURATION_KEYS)[number]

export const CATALOG_ORDERS: GameCatalogOrder[] = [
    GameCatalogOrder.Relevance,
    GameCatalogOrder.Recommended,
    GameCatalogOrder.Best,
    GameCatalogOrder.MostPlayed,
    GameCatalogOrder.Newest,
    GameCatalogOrder.MostCommented,
    GameCatalogOrder.NameAsc,
]

/** `/games?ladderType=Best` and friends used to be the tabs of the ladder. */
const LEGACY_LADDER_ORDER: { [key: string]: GameCatalogOrder } = {
    RecentAndMostPlayed: GameCatalogOrder.Recommended,
    MostPlayed: GameCatalogOrder.MostPlayed,
    Recent: GameCatalogOrder.Newest,
    Best: GameCatalogOrder.Best,
    MostCommented: GameCatalogOrder.MostCommented,
}

export const DEFAULT_CATALOG_STATE: CatalogState = {
    order: DEFAULT_CATALOG_ORDER,
    size: DEFAULT_CATALOG_SIZE,
    labelMode: 'all',
    labels: [],
    durations: [],
    withComments: false,
    withImage: false,
}

// ── URL <-> state ─────────────────────────────────────────

const first = (value?: string | string[]): string | undefined =>
    Array.isArray(value) ? value[0] : value

const parseList = (value?: string | string[]): string[] =>
    (first(value) ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .sort()

const parseNumber = (value?: string | string[]): number | undefined => {
    const raw = first(value)
    if (raw === undefined || raw.trim() === '') return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : undefined
}

const parseBool = (value?: string | string[]): boolean => ['1', 'true'].includes(first(value) ?? '')

export function parseCatalogState(query: ParsedUrlQuery): CatalogState {
    const requestedOrder = first(query.order) as GameCatalogOrder | undefined
    const legacyOrder = LEGACY_LADDER_ORDER[first(query.ladderType) ?? '']

    return {
        order:
            requestedOrder && CATALOG_ORDERS.includes(requestedOrder)
                ? requestedOrder
                : legacyOrder ?? DEFAULT_CATALOG_ORDER,
        size: parseNumber(query.size) ?? DEFAULT_CATALOG_SIZE,
        labelMode: first(query.mode) === 'any' ? 'any' : 'all',
        labels: parseList(query.labels),
        durations: parseList(query.dur).filter((key): key is DurationKey =>
            (DURATION_KEYS as readonly string[]).includes(key),
        ),
        yearFrom: parseNumber(query.yf),
        yearTo: parseNumber(query.yt),
        playersFrom: parseNumber(query.pf),
        playersTo: parseNumber(query.pt),
        minRating: parseNumber(query.rating),
        minRatings: parseNumber(query.minr),
        withComments: parseBool(query.comments),
        withImage: parseBool(query.img),
        addedWithinDays: parseNumber(query.days),
        query: first(query.q)?.trim() || undefined,
        author: parseNumber(query.autor),
        authorName: first(query.autorn)?.trim() || undefined,
    }
}

/** Defaults are omitted, so the same state always produces the same URL. */
export function catalogStateToQuery(state: CatalogState): { [key: string]: string } {
    const query: { [key: string]: string } = {}

    if (state.order !== DEFAULT_CATALOG_ORDER) query.order = state.order
    if (state.size !== DEFAULT_CATALOG_SIZE) query.size = String(state.size)
    if (state.labelMode !== 'all') query.mode = state.labelMode
    if (state.labels.length) query.labels = [...state.labels].sort().join(',')
    if (state.durations.length) query.dur = [...state.durations].sort().join(',')
    if (state.yearFrom != null) query.yf = String(state.yearFrom)
    if (state.yearTo != null) query.yt = String(state.yearTo)
    if (state.playersFrom != null) query.pf = String(state.playersFrom)
    if (state.playersTo != null) query.pt = String(state.playersTo)
    if (state.minRating != null) query.rating = String(state.minRating)
    if (state.minRatings != null) query.minr = String(state.minRatings)
    if (state.withComments) query.comments = '1'
    if (state.withImage) query.img = '1'
    if (state.addedWithinDays != null) query.days = String(state.addedWithinDays)
    if (state.query && state.query.trim()) query.q = state.query
    if (state.author != null) query.autor = String(state.author)
    if (state.authorName) query.autorn = state.authorName

    return query
}

/** Canonical identity of a state — used to detect "the filters changed". */
export function catalogStateKey(state: CatalogState): string {
    return JSON.stringify(catalogStateToQuery(state))
}

export function catalogStateToFilter(state: CatalogState): GameCatalogFilter {
    const filter: GameCatalogFilter = {}

    if (state.query) filter.query = state.query
    if (state.author != null) filter.authorIds = [String(state.author)]
    if (state.labels.length) {
        if (state.labelMode === 'any') {
            filter.anyLabels = [...state.labels]
        } else {
            filter.allLabels = [...state.labels]
        }
    }
    if (state.durations.length) filter.durations = [...state.durations]
    if (state.yearFrom != null) filter.yearFrom = state.yearFrom
    if (state.yearTo != null) filter.yearTo = state.yearTo
    if (state.playersFrom != null) filter.playersFrom = state.playersFrom
    if (state.playersTo != null) filter.playersTo = state.playersTo
    if (state.minRating != null) filter.minRating = state.minRating
    if (state.minRatings != null) filter.minRatings = state.minRatings
    if (state.withComments) filter.withComments = true
    if (state.withImage) filter.withImage = true
    if (state.addedWithinDays != null) filter.addedWithinDays = state.addedWithinDays

    return filter
}

// ── Changing the state ────────────────────────────────────

export function toggleLabel(state: CatalogState, labelId: string): CatalogState {
    const labels = state.labels.includes(labelId)
        ? state.labels.filter((id) => id !== labelId)
        : [...state.labels, labelId].sort()

    return { ...state, labels }
}

export function toggleDuration(state: CatalogState, key: DurationKey): CatalogState {
    const durations = state.durations.includes(key)
        ? state.durations.filter((item) => item !== key)
        : [...state.durations, key].sort()

    return { ...state, durations }
}

/** Drops every filter but keeps the order, the page size and the search term. */
export function clearCatalogFilters(state: CatalogState): CatalogState {
    return {
        ...DEFAULT_CATALOG_STATE,
        order: state.order,
        size: state.size,
        query: state.query,
    }
}

export function hasCatalogFilters(state: CatalogState): boolean {
    return (
        state.labels.length > 0 ||
        state.durations.length > 0 ||
        state.yearFrom != null ||
        state.yearTo != null ||
        state.playersFrom != null ||
        state.playersTo != null ||
        state.minRating != null ||
        state.minRatings != null ||
        state.withComments ||
        state.withImage ||
        state.addedWithinDays != null ||
        state.author != null ||
        Boolean(state.query)
    )
}

// ── Active filter chips ───────────────────────────────────

export interface CatalogActiveFilter {
    readonly key: string
    readonly kind:
        | 'label'
        | 'duration'
        | 'year'
        | 'players'
        | 'rating'
        | 'minRatings'
        | 'withComments'
        | 'withImage'
        | 'added'
        | 'query'
        | 'author'
    readonly value?: string
    readonly from?: number
    readonly to?: number
    readonly remove: Partial<CatalogState>
}

export function catalogActiveFilters(
    state: CatalogState,
    labelNames: { [id: string]: string },
): CatalogActiveFilter[] {
    const filters: CatalogActiveFilter[] = []

    state.labels.forEach((id) => {
        filters.push({
            key: `label:${id}`,
            kind: 'label',
            value: labelNames[id] ?? id,
            remove: { labels: state.labels.filter((labelId) => labelId !== id) },
        })
    })

    state.durations.forEach((key) => {
        filters.push({
            key: `duration:${key}`,
            kind: 'duration',
            value: key,
            remove: { durations: state.durations.filter((item) => item !== key) },
        })
    })

    if (state.yearFrom != null || state.yearTo != null) {
        filters.push({
            key: 'year',
            kind: 'year',
            from: state.yearFrom,
            to: state.yearTo,
            remove: { yearFrom: undefined, yearTo: undefined },
        })
    }

    if (state.playersFrom != null || state.playersTo != null) {
        filters.push({
            key: 'players',
            kind: 'players',
            from: state.playersFrom,
            to: state.playersTo,
            remove: { playersFrom: undefined, playersTo: undefined },
        })
    }

    if (state.minRating != null) {
        filters.push({
            key: 'rating',
            kind: 'rating',
            to: state.minRating,
            remove: { minRating: undefined },
        })
    }

    if (state.minRatings != null) {
        filters.push({
            key: 'minRatings',
            kind: 'minRatings',
            to: state.minRatings,
            remove: { minRatings: undefined },
        })
    }

    if (state.withComments) {
        filters.push({ key: 'comments', kind: 'withComments', remove: { withComments: false } })
    }

    if (state.withImage) {
        filters.push({ key: 'image', kind: 'withImage', remove: { withImage: false } })
    }

    if (state.addedWithinDays != null) {
        filters.push({
            key: 'added',
            kind: 'added',
            to: state.addedWithinDays,
            remove: { addedWithinDays: undefined },
        })
    }

    if (state.author != null) {
        filters.push({
            key: 'author',
            kind: 'author',
            value: state.authorName ?? String(state.author),
            remove: { author: undefined, authorName: undefined },
        })
    }

    if (state.query) {
        filters.push({ key: 'query', kind: 'query', value: state.query, remove: { query: undefined } })
    }

    return filters
}

/**
 * The text of one active-filter chip. Shared by the catalog and by the search
 * page's games section so both name the same filter the same way.
 */
export function catalogActiveFilterText(
    filter: CatalogActiveFilter,
    t: (key: string, options?: Record<string, unknown>) => string,
): string {
    switch (filter.kind) {
        case 'label':
            return t('Catalog.active.label', { name: filter.value })
        case 'duration':
            return t('Catalog.active.duration', { name: t(`Catalog.durations.${filter.value}`) })
        case 'year':
            return filter.from != null && filter.to != null
                ? t('Catalog.active.yearRange', { from: filter.from, to: filter.to })
                : filter.from != null
                ? t('Catalog.active.yearFrom', { from: filter.from })
                : t('Catalog.active.yearTo', { to: filter.to })
        case 'players':
            return filter.from != null && filter.to != null
                ? t('Catalog.active.playersRange', { from: filter.from, to: filter.to })
                : filter.from != null
                ? t('Catalog.active.playersFrom', { from: filter.from })
                : t('Catalog.active.playersTo', { to: filter.to })
        case 'rating':
            return t('Catalog.active.rating', { value: filter.to })
        case 'minRatings':
            return t('Catalog.active.minRatings', { count: filter.to })
        case 'withComments':
            return t('Catalog.filters.withComments')
        case 'withImage':
            return t('Catalog.filters.withImage')
        case 'added':
            return t('Catalog.active.added', { count: filter.to })
        case 'author':
            return t('Catalog.active.author', { name: filter.value })
        case 'query':
        default:
            return t('Catalog.active.query', { query: filter.value })
    }
}

// ── Presets ───────────────────────────────────────────────

export interface CatalogPreset {
    readonly key: string
    readonly textKey: string
    /** Label the preset selects, resolved to an id from the facets. */
    readonly labelName?: string
    readonly patch: Partial<CatalogState>
    readonly off: Partial<CatalogState>
}

export const CATALOG_PRESETS: CatalogPreset[] = [
    {
        key: 'komorni',
        textKey: 'Catalog.presets.komorni',
        labelName: 'komorní',
        patch: {},
        off: { labels: [] },
    },
    {
        key: 'drevarny',
        textKey: 'Catalog.presets.drevarny',
        labelName: 'dřevárna',
        patch: {},
        off: { labels: [] },
    },
    {
        key: 'novinky',
        textKey: 'Catalog.presets.novinky',
        patch: { order: GameCatalogOrder.Newest, addedWithinDays: 365 },
        off: { order: DEFAULT_CATALOG_ORDER, addedWithinDays: undefined },
    },
    {
        key: 'kratke',
        textKey: 'Catalog.presets.kratke',
        patch: { durations: ['short'] },
        off: { durations: [] },
    },
    {
        key: 'velke',
        textKey: 'Catalog.presets.velke',
        patch: { playersFrom: 20 },
        off: { playersFrom: undefined },
    },
    {
        key: 'doporucovane',
        textKey: 'Catalog.presets.doporucovane',
        patch: { minRating: RECOMMENDED_FROM, minRatings: MIN_NUM_RATINGS },
        off: { minRating: undefined, minRatings: undefined },
    },
]

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function presetPatch(
    preset: CatalogPreset,
    labelIdsByName: { [name: string]: string },
): Partial<CatalogState> | undefined {
    if (!preset.labelName) return preset.patch

    const labelId = labelIdsByName[preset.labelName]
    if (!labelId) return undefined

    return { ...preset.patch, labels: [labelId] }
}

export function isPresetActive(
    preset: CatalogPreset,
    state: CatalogState,
    labelIdsByName: { [name: string]: string },
): boolean {
    const patch = presetPatch(preset, labelIdsByName)
    if (!patch) return false

    return Object.keys(patch).every((key) =>
        sameValue(patch[key as keyof CatalogState], state[key as keyof CatalogState]),
    )
}

export function togglePreset(
    preset: CatalogPreset,
    state: CatalogState,
    labelIdsByName: { [name: string]: string },
): CatalogState {
    const patch = presetPatch(preset, labelIdsByName)
    if (!patch) return state

    return isPresetActive(preset, state, labelIdsByName)
        ? { ...state, ...preset.off }
        : { ...state, ...patch }
}
