import { format } from 'date-fns'
import { CalendarEventDataFragment } from '../../graphql/__generated__/typescript-operations'
import { CalendarDuration, CalendarPlace, CalendarState, CalendarWhen } from './calendarState'
import { parseDateTime } from '../../utils/dateUtils'

/**
 * Helpers behind the calendar's three views: the weekend agenda, the month grid
 * and the history chart. Everything works on the events the server returned
 * (the whole future of the calendar fits in one page) and on `today`, which is
 * passed in so tests do not depend on the wall clock.
 */

type Translate = (key: string, options?: Record<string, unknown>) => string

export interface EventSpan {
    readonly start: Date
    readonly end: Date
    readonly days: number
}

export const toEventDate = (value?: string | null): Date | undefined => parseDateTime(value)

/**
 * Start and end of an event, always at least one day long. The database has
 * archive rows whose `to` is *before* `from` (30 of them, up to −29 days), which
 * would otherwise produce a negative length and sort nonsense into the list.
 */
export const eventSpan = (event: Pick<CalendarEventDataFragment, 'from' | 'to'>): EventSpan | undefined => {
    const start = toEventDate(event.from)
    if (!start) return undefined

    const rawEnd = toEventDate(event.to) ?? start
    const end = rawEnd.getTime() < start.getTime() ? start : rawEnd

    return { start, end, days: Math.round((end.getTime() - start.getTime()) / 86400000) + 1 }
}

export const durationBucket = (span: EventSpan): CalendarDuration => {
    if (span.days === 1) return 'one'
    return span.days >= 5 ? 'long' : 'weekend'
}

/**
 * Countries used to recognise a foreign event. The database has no country
 * column and `loc` is free text ("Brno", "online", "Les pri Hrade Červený
 * Kameň, Častá, Slovensko", a full address with GPS…), so this is a heuristic
 * over that text plus the "(mezinárodní)" marker in the name. It is used for
 * the "zahraničí" filter and it is deliberately forgiving: an event is only
 * marked foreign when the text actually says so.
 */
const FOREIGN_HINTS = [
    'polsko',
    'německ',
    'slovensko',
    'slovensku',
    'londýn',
    'rakous',
    'angli',
    'irsko',
    'maďars',
    'franci',
    'belgi',
    'holand',
    'nizozem',
    'dánsk',
    'švédsk',
    'finsk',
    'estonsk',
    'lotyšsk',
    'litv',
    'chorvats',
    'italsk',
    'španěl',
    'portugal',
    'rumunsk',
    'bulhars',
    'srbsk',
    'ukrajin',
    'usa',
    'kanad',
]

export const isForeignLocation = (loc?: string | null): boolean => {
    const text = (loc ?? '').toLowerCase()
    return FOREIGN_HINTS.some((hint) => text.includes(hint))
}

export const isInternationalEvent = (name?: string | null): boolean =>
    (name ?? '').toLowerCase().includes('mezinárodní')

export const eventPlace = (event: Pick<CalendarEventDataFragment, 'loc' | 'name'>): CalendarPlace => {
    // The two hints come first: an international event without a location is
    // still an event abroad, not a record with a missing location.
    if (isForeignLocation(event.loc) || isInternationalEvent(event.name)) return 'foreign'
    return (event.loc ?? '').trim() ? 'cz' : 'noloc'
}

export const eventLabelNames = (event: Pick<CalendarEventDataFragment, 'labels'>): string[] =>
    (event.labels ?? []).map((label) => label.name ?? label.id).filter(Boolean)

// ── Time windows ──────────────────────────────────────────

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

/** Saturday of the weekend that starts this week (Monday based). */
const upcomingSaturday = (today: Date): Date => {
    const weekday = (today.getDay() + 6) % 7 // 0 = Monday
    const saturday = addDays(today, 5 - weekday)
    return saturday.getTime() < startOfDay(today).getTime() ? addDays(saturday, 7) : saturday
}

const monthBounds = (year: number, month: number) => ({
    from: new Date(year, month, 1),
    to: new Date(year, month + 1, 0),
})

export const monthKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export const parseMonthKey = (key: string): { year: number; month: number } => {
    const [year, month] = key.split('-').map(Number)
    return { year, month: month - 1 }
}

export const calendarWindow = (
    when: CalendarWhen,
    today: Date,
    month?: string,
): { from: Date; to: Date } | undefined => {
    switch (when) {
        case 'weekend': {
            const saturday = upcomingSaturday(today)
            return { from: saturday, to: addDays(saturday, 1) }
        }
        case 'nextweekend': {
            const saturday = addDays(upcomingSaturday(today), 7)
            return { from: saturday, to: addDays(saturday, 1) }
        }
        case 'month': {
            if (month) {
                const { year, month: monthIndex } = parseMonthKey(month)
                return monthBounds(year, monthIndex)
            }
            return monthBounds(today.getFullYear(), today.getMonth())
        }
        case 'quarter':
            return {
                from: new Date(today.getFullYear(), today.getMonth(), 1),
                to: new Date(today.getFullYear(), today.getMonth() + 3, 0),
            }
        case 'all':
        default:
            return undefined
    }
}

/**
 * Filters applied on the client. The calendar is small (tens of events in the
 * future), so exact counts are cheaper here than a round trip per checkbox, and
 * the counts in the sidebar are the real numbers of the loaded list.
 */
export const filterCalendarEvents = (
    events: readonly CalendarEventDataFragment[],
    state: CalendarState,
    today: Date,
): CalendarEventDataFragment[] => {
    const window = calendarWindow(state.when, today, state.month)

    return events.filter((event) => {
        const span = eventSpan(event)
        if (!span) return false

        if (window) {
            const start = startOfDay(span.start).getTime()
            const end = startOfDay(span.end).getTime()
            if (end < window.from.getTime() || start > window.to.getTime()) return false
        }

        if (state.durations.length && !state.durations.includes(durationBucket(span))) return false

        if (state.places.length && !state.places.includes(eventPlace(event))) return false

        if (state.withWeb && !event.web) return false

        if (state.labels.length) {
            const ids = (event.labels ?? []).map((label) => label.id)
            const matches =
                state.labelMode === 'any'
                    ? state.labels.some((id) => ids.includes(id))
                    : state.labels.every((id) => ids.includes(id))
            if (!matches) return false
        }

        return true
    })
}

// ── Weekend grouping ──────────────────────────────────────

export interface WeekBlock {
    readonly key: string
    readonly from: Date
    readonly to: Date
    readonly events: CalendarEventDataFragment[]
}

/** Monday of the week the date falls into. */
export const weekStart = (date: Date): Date => {
    const weekday = (date.getDay() + 6) % 7 // 0 = Monday
    return addDays(date, -weekday)
}

export const groupEventsByWeek = (events: readonly CalendarEventDataFragment[]): WeekBlock[] => {
    const blocks = new Map<string, WeekBlock>()

    events.forEach((event) => {
        const span = eventSpan(event)
        if (!span) return

        const key = format(weekStart(span.start), 'yyyy-MM-dd')
        const existing = blocks.get(key)

        if (!existing) {
            blocks.set(key, { key, from: span.start, to: span.end, events: [event] })
            return
        }

        blocks.set(key, {
            key,
            from: span.start.getTime() < existing.from.getTime() ? span.start : existing.from,
            to: span.end.getTime() > existing.to.getTime() ? span.end : existing.to,
            events: [...existing.events, event],
        })
    })

    return Array.from(blocks.values()).sort((a, b) => a.from.getTime() - b.from.getTime())
}

export interface FreeWeekend {
    readonly saturday: Date
    readonly sunday: Date
}

/**
 * Weekends (Saturday + Sunday) with no event running, from `today` until
 * `until`. Used for the "volný víkend" rows — a larp calendar is read weekend by
 * weekend, so "nothing is on" is information, not empty space.
 */
export const freeWeekends = (
    events: readonly CalendarEventDataFragment[],
    today: Date,
    until: Date,
): FreeWeekend[] => {
    const spans = events
        .map((event) => eventSpan(event))
        .filter((span): span is EventSpan => Boolean(span))
        .map((span) => ({ from: startOfDay(span.start).getTime(), to: startOfDay(span.end).getTime() }))

    const overlaps = (day: Date) => {
        const time = day.getTime()
        return spans.some((span) => span.from <= time && span.to >= time)
    }

    const weekends: FreeWeekend[] = []
    let day = startOfDay(today)

    while (day.getTime() <= until.getTime()) {
        if (day.getDay() === 6) {
            const sunday = addDays(day, 1)
            if (!overlaps(day) && !overlaps(sunday)) {
                weekends.push({ saturday: day, sunday })
            }
        }
        day = addDays(day, 1)
    }

    return weekends
}

// ── Month grid with bars spanning days ────────────────────

export interface MonthBar {
    readonly columnStart: number
    readonly columnEnd: number
    readonly lane: number
    readonly event: CalendarEventDataFragment
}

export interface MonthWeek {
    readonly days: Date[]
    readonly bars: MonthBar[]
    readonly lanes: number
}

export interface MonthGridData {
    readonly year: number
    readonly month: number
    readonly weeks: MonthWeek[]
}

/** Place events of one week into lanes so that overlapping bars do not collide. */
const layoutBarLanes = (bars: Omit<MonthBar, 'lane'>[]): { bars: MonthBar[]; lanes: number } => {
    const laneEnds: number[] = []
    const placed = [...bars]
        .sort((a, b) => a.columnStart - b.columnStart || b.columnEnd - a.columnEnd)
        .map((bar) => {
            let lane = laneEnds.findIndex((end) => end < bar.columnStart)
            if (lane === -1) {
                lane = laneEnds.length
                laneEnds.push(bar.columnEnd)
            } else {
                laneEnds[lane] = bar.columnEnd
            }
            return { ...bar, lane }
        })

    return { bars: placed, lanes: Math.max(1, laneEnds.length) }
}

export const buildMonthGrid = (
    year: number,
    month: number,
    events: readonly CalendarEventDataFragment[],
): MonthGridData => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const start = weekStart(first)

    const weeks: MonthWeek[] = []
    let cursor = start

    while (cursor.getTime() <= last.getTime()) {
        const days = Array.from({ length: 7 }, (_, index) => addDays(cursor, index))
        const weekFrom = days[0].getTime()
        const weekTo = days[6].getTime()

        const bars: Omit<MonthBar, 'lane'>[] = []
        events.forEach((event) => {
            const span = eventSpan(event)
            if (!span) return

            const from = startOfDay(span.start).getTime()
            const to = startOfDay(span.end).getTime()
            if (from > weekTo || to < weekFrom) return

            const columnStart = Math.max(0, Math.round((from - weekFrom) / 86400000))
            const columnEnd = Math.min(6, Math.round((to - weekFrom) / 86400000))
            bars.push({ columnStart, columnEnd, event })
        })

        const laidOut = layoutBarLanes(bars)
        weeks.push({ days, bars: laidOut.bars, lanes: laidOut.lanes })

        cursor = addDays(cursor, 7)
    }

    return { year, month, weeks }
}

// ── Links ─────────────────────────────────────────────────

/** Google Calendar template link, so one event can be added without subscribing. */
export const googleCalendarUrl = (event: CalendarEventDataFragment): string | undefined => {
    const span = eventSpan(event)
    if (!span) return undefined

    const stamp = (date: Date) =>
        `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.name ?? '',
        dates: `${stamp(span.start)}/${stamp(addDays(span.end, 1))}`,
    })
    if (event.loc) params.set('location', event.loc)
    if (event.web) params.set('details', event.web)

    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// ── Formatting (month and weekday names come from the locale) ──

export const monthName = (t: Translate, monthIndex: number): string => t(`Calendar.months.${monthIndex + 1}`)

export const monthShort = (t: Translate, monthIndex: number): string =>
    t(`Calendar.monthsShort.${monthIndex + 1}`)

/** Weekday abbreviation, 0 = Monday. */
export const weekdayShort = (t: Translate, weekday: number): string => t(`Calendar.weekdays.${weekday + 1}`)

export const formatDate = (date: Date): string => format(date, 'd.M.yyyy')

export const formatDayMonth = (t: Translate, date: Date): string =>
    `${date.getDate()}. ${monthName(t, date.getMonth())}`

export const formatShortRange = (t: Translate, from: Date, to: Date): string => {
    const start = `${weekdayShort(t, (from.getDay() + 6) % 7)} ${from.getDate()}.`
    if (from.getTime() === to.getTime()) return formatDayMonth(t, from)

    const end = `${weekdayShort(t, (to.getDay() + 6) % 7)} ${to.getDate()}.`
    return from.getMonth() === to.getMonth()
        ? `${start} – ${end} ${monthName(t, to.getMonth())} ${to.getFullYear()}`
        : `${start} ${monthName(t, from.getMonth())} – ${end} ${monthName(t, to.getMonth())} ${to.getFullYear()}`
}

/** "za 5 dní" / "probíhá teď" / a month name for events further away. */
export const relativeHint = (t: Translate, span: EventSpan, today: Date): string => {
    const days = Math.round((startOfDay(span.start).getTime() - startOfDay(today).getTime()) / 86400000)
    if (days <= 0 && days + span.days > 0) return t('Calendar.relative.now')
    if (days === 1) return t('Calendar.relative.tomorrow')
    if (days > 0 && days < 14) return t('Calendar.relative.inDays', { count: days })
    return `${monthName(t, span.start.getMonth())} ${span.start.getFullYear()}`
}

/** The "next" event: the first one that has not finished yet. */
export const nextEventId = (
    events: readonly CalendarEventDataFragment[],
    today: Date,
): string | undefined => {
    const upcoming = events
        .map((event) => ({ event, span: eventSpan(event) }))
        .filter((item): item is { event: CalendarEventDataFragment; span: EventSpan } => Boolean(item.span))
        .filter((item) => startOfDay(item.span.end).getTime() >= startOfDay(today).getTime())
        .sort((a, b) => a.span.start.getTime() - b.span.start.getTime())

    return upcoming[0]?.event.id
}
