import { ParsedUrlQuery } from 'querystring'

/**
 * State of the event calendar (the page at /kalendar).
 *
 * Like the games catalog, the whole state lives in the URL, so a filtered
 * calendar can be bookmarked, shared and re-opened with the back button. The
 * old `/kalendar?initialRequiredLabelIds=…` links keep working — the previous
 * page parsed those two parameters and then dropped them on the floor (the
 * panel it rendered ignored its props), so such a link silently showed an
 * unfiltered list.
 */

export type CalendarView = 'vikendy' | 'mesic' | 'historie'

/** Time window preset. The concrete dates are derived in calendarWindow(). */
export type CalendarWhen = 'all' | 'weekend' | 'nextweekend' | 'month' | 'quarter'

/** 1 day / 3–4 days (a weekend) / 5 days and more. */
export type CalendarDuration = 'one' | 'weekend' | 'long'

/**
 * Where the event happens. The database has no country column — `loc` is free
 * text — so `foreign` is a heuristic over that text (see calendarUtils).
 * `noloc` is exact: the location is empty, which is the state worth fixing.
 */
export type CalendarPlace = 'cz' | 'foreign' | 'noloc'

export type CalendarLabelMode = 'all' | 'any'

export interface CalendarState {
    readonly view: CalendarView
    readonly when: CalendarWhen
    /** Selected month in `YYYY-MM`, used by the season strip and the grid. */
    readonly month?: string
    readonly durations: readonly CalendarDuration[]
    readonly places: readonly CalendarPlace[]
    readonly withWeb: boolean
    readonly labels: readonly string[]
    readonly labelMode: CalendarLabelMode
    /** Year selected in the history view. */
    readonly year?: number
    /**
     * Free text over the event name and place. The calendar is the page a
     * visitor opens when they half remember an event ("that Requiem in Brno"),
     * and until now it could not be typed into at all.
     */
    readonly query?: string
}

export const CALENDAR_VIEWS: CalendarView[] = ['vikendy', 'mesic', 'historie']
export const CALENDAR_WHENS: CalendarWhen[] = ['all', 'weekend', 'nextweekend', 'month', 'quarter']
export const CALENDAR_DURATIONS: CalendarDuration[] = ['one', 'weekend', 'long']
export const CALENDAR_PLACES: CalendarPlace[] = ['cz', 'foreign', 'noloc']

export const DEFAULT_CALENDAR_STATE: CalendarState = {
    view: 'vikendy',
    when: 'all',
    durations: [],
    places: [],
    withWeb: false,
    labels: [],
    labelMode: 'all',
}

const first = (value?: string | string[]): string | undefined =>
    Array.isArray(value) ? value[0] : value

const parseList = <T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] =>
    (Array.isArray(value) ? value : [first(value) ?? ''])
        .flatMap((item) => item.split(','))
        .map((item) => item.trim())
        .filter((item): item is T => (allowed as readonly string[]).includes(item))
        .sort()

const parseIds = (value?: string | string[]): string[] =>
    (Array.isArray(value) ? value : [first(value) ?? ''])
        .flatMap((item) => item.split(','))
        .map((item) => item.trim())
        .filter(Boolean)
        .sort()

const parseMonth = (value?: string | string[]): string | undefined => {
    const raw = first(value)
    if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return undefined

    const month = Number(raw.slice(5, 7))
    return month >= 1 && month <= 12 ? raw : undefined
}

const parseYear = (value?: string | string[]): number | undefined => {
    const parsed = Number(first(value))
    return Number.isInteger(parsed) && parsed > 1900 && parsed < 2200 ? parsed : undefined
}

export function parseCalendarState(query: ParsedUrlQuery): CalendarState {
    const requestedView = first(query.v) as CalendarView | undefined
    const requestedWhen = first(query.kdy) as CalendarWhen | undefined

    // Legacy parameters of the old page.
    const legacyRequired = parseIds(query.initialRequiredLabelIds)
    const legacyOptional = parseIds(query.initialOptionalLabelIds)
    const legacyLabels = legacyRequired.length ? legacyRequired : legacyOptional

    return {
        view: requestedView && CALENDAR_VIEWS.includes(requestedView) ? requestedView : 'vikendy',
        when: requestedWhen && CALENDAR_WHENS.includes(requestedWhen) ? requestedWhen : 'all',
        month: parseMonth(query.m),
        durations: parseList(query.dd, CALENDAR_DURATIONS),
        places: parseList(query.dk, CALENDAR_PLACES),
        withWeb: ['1', 'true'].includes(first(query.web) ?? ''),
        labels: parseIds(query.lb).length ? parseIds(query.lb) : legacyLabels,
        labelMode:
            first(query.lm) === 'any' || (!legacyRequired.length && legacyOptional.length) ? 'any' : 'all',
        year: parseYear(query.r),
        query: first(query.q)?.trim() || undefined,
    }
}

/** Defaults are omitted, so the same state always produces the same URL. */
export function calendarStateToQuery(state: CalendarState): { [key: string]: string } {
    const query: { [key: string]: string } = {}

    if (state.view !== 'vikendy') query.v = state.view
    if (state.when !== 'all') query.kdy = state.when
    if (state.month) query.m = state.month
    if (state.durations.length) query.dd = [...state.durations].sort().join(',')
    if (state.places.length) query.dk = [...state.places].sort().join(',')
    if (state.withWeb) query.web = '1'
    if (state.labels.length) query.lb = [...state.labels].sort().join(',')
    if (state.labelMode !== 'all') query.lm = state.labelMode
    if (state.year) query.r = String(state.year)
    // A blank query never reaches the state (parse drops it, the input clears to
    // undefined) — never serialise one either, so the URL stays canonical.
    if (state.query && state.query.trim()) query.q = state.query

    return query
}

/** Canonical identity of a state — used to detect "the filters changed". */
export function calendarStateKey(state: CalendarState): string {
    return JSON.stringify(calendarStateToQuery(state))
}

export function toggleListValue<T extends string>(list: readonly T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value].sort()
}

export function toggleDuration(state: CalendarState, value: CalendarDuration): CalendarState {
    return { ...state, durations: toggleListValue(state.durations, value) }
}

export function togglePlace(state: CalendarState, value: CalendarPlace): CalendarState {
    return { ...state, places: toggleListValue(state.places, value) }
}

export function toggleLabel(state: CalendarState, labelId: string): CalendarState {
    return { ...state, labels: toggleListValue(state.labels, labelId) }
}

export function clearCalendarFilters(state: CalendarState): CalendarState {
    return {
        ...DEFAULT_CALENDAR_STATE,
        view: state.view,
        year: state.year,
        query: state.query,
    }
}

export function hasCalendarFilters(state: CalendarState): boolean {
    return (
        state.when !== 'all' ||
        state.durations.length > 0 ||
        state.places.length > 0 ||
        state.withWeb ||
        state.labels.length > 0 ||
        Boolean(state.query)
    )
}

// ── Active filter chips ───────────────────────────────────

export interface CalendarActiveFilter {
    readonly key: string
    readonly kind: 'when' | 'duration' | 'place' | 'withWeb' | 'label' | 'query'
    readonly value?: string
    readonly remove: Partial<CalendarState>
}

export function calendarActiveFilters(
    state: CalendarState,
    labelNames: { [id: string]: string },
): CalendarActiveFilter[] {
    const filters: CalendarActiveFilter[] = []

    if (state.when !== 'all') {
        filters.push({ key: `when:${state.when}`, kind: 'when', value: state.when, remove: { when: 'all' } })
    }

    state.durations.forEach((duration) => {
        filters.push({
            key: `duration:${duration}`,
            kind: 'duration',
            value: duration,
            remove: { durations: state.durations.filter((item) => item !== duration) },
        })
    })

    state.places.forEach((place) => {
        filters.push({
            key: `place:${place}`,
            kind: 'place',
            value: place,
            remove: { places: state.places.filter((item) => item !== place) },
        })
    })

    if (state.withWeb) {
        filters.push({ key: 'web', kind: 'withWeb', remove: { withWeb: false } })
    }

    if (state.query) {
        filters.push({
            key: 'query',
            kind: 'query',
            value: state.query,
            remove: { query: undefined },
        })
    }

    state.labels.forEach((id) => {
        filters.push({
            key: `label:${id}`,
            kind: 'label',
            value: labelNames[id] ?? id,
            remove: { labels: state.labels.filter((labelId) => labelId !== id) },
        })
    })

    return filters
}
