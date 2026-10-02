import React, { useEffect, useMemo, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useApolloClient } from '@apollo/client'
import { DocumentNode } from 'graphql'
import { useRouter } from 'next/router'
import { ParsedUrlQuery } from 'querystring'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import BigLoading from '../common/BigLoading/BigLoading'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'
import { componentTestIds } from '../componentTestIds'
import { useRoutes } from '../../hooks/useRoutes'
import { formatISODate } from '../../utils/dateUtils'
import {
    CalendarEventDataFragment,
    CalendarEventsQuery,
    CalendarEventsQueryVariables,
    CalendarStatsQuery,
} from '../../graphql/__generated__/typescript-operations'
import SeasonStrip, { SeasonMonth } from './SeasonStrip'
import WeekendAgenda from './WeekendAgenda'
import MonthGrid from './MonthGrid'
import HistoryView from './HistoryView'
import CalendarEventCard from './CalendarEventCard'
import {
    CALENDAR_DURATIONS,
    CALENDAR_PLACES,
    CALENDAR_VIEWS,
    CALENDAR_WHENS,
    CalendarDuration,
    CalendarPlace,
    CalendarState,
    CalendarWhen,
    calendarActiveFilters,
    calendarStateKey,
    calendarStateToQuery,
    clearCalendarFilters,
    hasCalendarFilters,
    parseCalendarState,
    toggleDuration,
    toggleLabel,
    togglePlace,
} from './calendarState'
import {
    eventLabelNames,
    eventPlace,
    eventSpan,
    durationBucket,
    filterCalendarEvents,
    formatDate,
    freeWeekends,
    monthName,
    monthShort,
    nextEventId,
} from './calendarUtils'

import * as calendarEventsDocument from './graphql/calendarEvents.graphql'
import * as calendarStatsDocument from './graphql/calendarStats.graphql'

// The webpack loader exports the document as CommonJS, an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const calendarEventsGql = documentOf(calendarEventsDocument)
const calendarStatsGql = documentOf(calendarStatsDocument)

interface Props {
    readonly initialQuery: ParsedUrlQuery
}

const PAGE_SIZE = 100
/** Months shown in the season strip, starting with the current one. */
const SEASON_MONTHS = 12
/** The archive starts with the oldest events in the database. */
const STATS_FROM = '2009-01-01'
const STATS_TO = '2035-01-01'

interface CalendarPage {
    readonly events: CalendarEventDataFragment[]
    readonly totalAmount: number
}

type StatsMonth = CalendarStatsQuery['eventCalendarStats']['byMonth'][number]

interface StatsPage {
    readonly totalAmount: number
    readonly byMonth: StatsMonth[]
}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0 40px',
        minHeight: '60vh',
    },
    loading: {
        opacity: 0.5,
    },
    head: {
        display: 'flex',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 14,
    },
    title: {
        margin: '0 0 4px',
        fontSize: '1.6rem',
        color: darkTheme.textOnLightDark,
    },
    subtitle: {
        fontSize: '0.78rem',
        color: darkTheme.textOnLightLighter,
        maxWidth: 620,
    },
    strong: {
        color: darkTheme.textGreenDark,
        fontWeight: 700,
    },
    actions: {
        marginLeft: 'auto',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
    },
    button: {
        padding: '9px 14px',
        border: 0,
        borderRadius: 4,
        backgroundColor: darkTheme.textGreenDark,
        color: darkTheme.backgroundRealWhite,
        fontWeight: 700,
        fontSize: '0.78rem',
        cursor: 'pointer',
    },
    buttonGhost: {
        backgroundColor: 'transparent',
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        color: darkTheme.textOnLight,
    },
    side: {
        backgroundColor: darkTheme.backgroundRealWhite,
        borderRadius: 5,
        padding: '12px 14px',
    },
    filterGroup: {
        borderTop: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        padding: '10px 0 6px',

        '&:first-child': {
            borderTop: 0,
            paddingTop: 0,
        },
    },
    filterTitle: {
        margin: '0 0 7px',
        fontSize: '0.72rem',
        textTransform: 'uppercase',
        letterSpacing: '.07em',
        color: darkTheme.textOnLightDark,
    },
    filter: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '3px 0',
        fontSize: '0.78rem',
        color: darkTheme.textOnLight,
        cursor: 'pointer',
    },
    filterDisabled: {
        color: darkTheme.textLighter,
        cursor: 'default',
    },
    filterCount: {
        marginLeft: 'auto',
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
    },
    hint: {
        margin: '6px 0 0',
        fontSize: '0.7rem',
        lineHeight: 1.4,
        color: darkTheme.textOnLightLighter,
    },
    switch: {
        display: 'inline-flex',
        backgroundColor: darkTheme.backgroundRealWhite,
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 5,
        padding: 2,
        marginBottom: 12,
    },
    switchButton: {
        padding: '7px 15px',
        border: 0,
        borderRadius: 4,
        backgroundColor: 'transparent',
        color: darkTheme.textOnLight,
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: 'pointer',
    },
    switchButtonActive: {
        backgroundColor: darkTheme.backgroundAlmostNearWhite,
        color: darkTheme.textOnLightDark,
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 12,
        fontSize: '0.75rem',
        color: darkTheme.textOnLight,
    },
    chips: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 9px',
        border: 0,
        borderRadius: 12,
        backgroundColor: darkTheme.backgroundAlmostNearWhite2,
        color: darkTheme.textOnLight,
        fontSize: '0.7rem',
        cursor: 'pointer',
    },
    empty: {
        padding: 30,
        backgroundColor: darkTheme.backgroundRealWhite,
        borderRadius: 5,
        textAlign: 'center',
        color: darkTheme.textOnLight,
    },
    more: {
        marginTop: 18,
        textAlign: 'center',
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        actions: {
            marginLeft: 0,
        },
    },
})

/**
 * The event calendar. Replaces the flat list that had a 100-item pager for 29
 * events, a blank line in every row (the labels, which 28 of 29 events do not
 * have) and two URL parameters it parsed and then ignored. Three views share one
 * state in the URL: weekends (the default — larp events are weekend events), a
 * month grid with bars spanning days, and the archive, which shows the years
 * the page never showed at all.
 */
const CalendarPanel = ({ initialQuery }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const router = useRouter()
    const client = useApolloClient()
    const routes = useRoutes()

    const [state, setState] = useState<CalendarState>(() => parseCalendarState(initialQuery))
    const [page, setPage] = useState<CalendarPage | undefined>(undefined)
    const [stats, setStats] = useState<StatsPage | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [yearPage, setYearPage] = useState<CalendarPage | undefined>(undefined)
    const [loadingYear, setLoadingYear] = useState(false)

    const today = useMemo(() => new Date(), [])
    const todayIso = useMemo(() => formatISODate(today) as string, [today])

    // The URL is the source of truth for shared links and the back button.
    useEffect(() => {
        const fromUrl = parseCalendarState(router.query)
        setState((current) => (calendarStateKey(fromUrl) === calendarStateKey(current) ? current : fromUrl))
    }, [router.query])

    // Future events: the whole future of the calendar fits in a single page.
    useEffect(() => {
        let cancelled = false
        setLoading(true)

        client
            .query<CalendarEventsQuery, CalendarEventsQueryVariables>({
                query: calendarEventsGql,
                variables: { from: todayIso, offset: 0, limit: PAGE_SIZE },
                fetchPolicy: 'cache-first',
            })
            .then((response) => {
                if (cancelled) return
                setPage(response.data.eventCalendar)
                setLoading(false)
            })
            .catch(() => {
                if (cancelled) return
                setPage(undefined)
                setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [todayIso])

    // Monthly counts for the season strip and the history chart.
    useEffect(() => {
        let cancelled = false

        client
            .query<CalendarStatsQuery>({
                query: calendarStatsGql,
                variables: { from: STATS_FROM, to: STATS_TO },
                fetchPolicy: 'cache-first',
            })
            .then((response) => {
                if (!cancelled) setStats(response.data.eventCalendarStats)
            })
            .catch(() => undefined)

        return () => {
            cancelled = true
        }
    }, [])

    const selectedYear = state.view === 'historie' ? state.year : undefined

    // Archive of the selected year, one page at a time.
    useEffect(() => {
        if (!selectedYear) {
            setYearPage(undefined)
            return undefined
        }

        let cancelled = false
        setLoadingYear(true)

        client
            .query<CalendarEventsQuery, CalendarEventsQueryVariables>({
                query: calendarEventsGql,
                variables: {
                    from: `${selectedYear}-01-01`,
                    to: `${selectedYear + 1}-01-01`,
                    offset: 0,
                    limit: PAGE_SIZE,
                },
                fetchPolicy: 'cache-first',
            })
            .then((response) => {
                if (cancelled) return
                setYearPage(response.data.eventCalendar)
                setLoadingYear(false)
            })
            .catch(() => {
                if (!cancelled) setLoadingYear(false)
            })

        return () => {
            cancelled = true
        }
    }, [selectedYear])

    const commitState = (next: CalendarState) => {
        setState(next)
        router.replace({ pathname: router.pathname, query: calendarStateToQuery(next) }, undefined, {
            shallow: true,
        })
    }

    const updateState = (patch: Partial<CalendarState>) => commitState({ ...state, ...patch })

    const handleLoadMore = () => {
        if (!page || loadingMore) return
        setLoadingMore(true)

        client
            .query<CalendarEventsQuery, CalendarEventsQueryVariables>({
                query: calendarEventsGql,
                variables: { from: todayIso, offset: page.events.length, limit: PAGE_SIZE },
                fetchPolicy: 'network-only',
            })
            .then((response) => {
                const more = response.data.eventCalendar.events
                setPage({
                    events: [...page.events, ...more],
                    totalAmount: response.data.eventCalendar.totalAmount,
                })
            })
            .finally(() => setLoadingMore(false))
    }

    const handleLoadMoreYear = () => {
        if (!yearPage || !selectedYear || loadingYear) return
        setLoadingYear(true)

        client
            .query<CalendarEventsQuery, CalendarEventsQueryVariables>({
                query: calendarEventsGql,
                variables: {
                    from: `${selectedYear}-01-01`,
                    to: `${selectedYear + 1}-01-01`,
                    offset: yearPage.events.length,
                    limit: PAGE_SIZE,
                },
                fetchPolicy: 'network-only',
            })
            .then((response) => {
                setYearPage({
                    events: [...yearPage.events, ...response.data.eventCalendar.events],
                    totalAmount: response.data.eventCalendar.totalAmount,
                })
            })
            .finally(() => setLoadingYear(false))
    }

    const allEvents = useMemo(() => page?.events ?? [], [page])
    const filtered = useMemo(() => filterCalendarEvents(allEvents, state, today), [allEvents, state, today])
    const nextId = useMemo(() => nextEventId(allEvents, today), [allEvents, today])

    // Season strip: the next twelve months, counted from the whole database.
    const seasonMonths = useMemo<SeasonMonth[]>(() => {
        const counts = new Map<string, number>()
        ;(stats?.byMonth ?? []).forEach((month) => {
            const key = `${month.year}-${String(month.month).padStart(2, '0')}`
            counts.set(key, (counts.get(key) ?? 0) + month.count)
        })

        return Array.from({ length: SEASON_MONTHS }, (_, index) => {
            const date = new Date(today.getFullYear(), today.getMonth() + index, 1)
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            return {
                key,
                label: `${monthShort(t, date.getMonth())} ${String(date.getFullYear()).slice(2)}`,
                count: counts.get(key) ?? 0,
            }
        })
    }, [stats, today, t])

    const seasonEnd = useMemo(() => {
        const last = seasonMonths[seasonMonths.length - 1]
        if (!last) return today
        const [year, month] = last.key.split('-').map(Number)
        return new Date(year, month, 0)
    }, [seasonMonths, today])

    // Counts in the sidebar are the real numbers of the loaded list.
    const countFor = (predicate: (event: CalendarEventDataFragment) => boolean) =>
        allEvents.filter(predicate).length

    const windowCount = (when: CalendarWhen) => {
        const candidate: CalendarState = { ...state, when, month: undefined }
        return filterCalendarEvents(allEvents, { ...candidate, durations: [], places: [], withWeb: false, labels: [] }, today)
            .length
    }

    const labelFacets = useMemo(() => {
        const counts = new Map<string, { id: string; name: string; count: number }>()
        allEvents.forEach((event) => {
            ;(event.labels ?? []).forEach((label) => {
                const existing = counts.get(label.id) ?? { id: label.id, name: label.name ?? label.id, count: 0 }
                existing.count += 1
                counts.set(label.id, existing)
            })
        })
        return Array.from(counts.values()).sort((a, b) => b.count - a.count)
    }, [allEvents])

    const labelNames = useMemo(
        () => labelFacets.reduce<{ [id: string]: string }>((map, label) => ({ ...map, [label.id]: label.name }), {}),
        [labelFacets],
    )

    const activeFilters = calendarActiveFilters(state, labelNames)
    const filterText = (kind: string, value?: string) => {
        switch (kind) {
            case 'when':
                return t(`Calendar.filters.when_${value}`)
            case 'duration':
                return t(`Calendar.filters.duration_${value}`)
            case 'place':
                return t(`Calendar.filters.place_${value}`)
            case 'withWeb':
                return t('Calendar.filters.withWeb')
            default:
                return t('Calendar.active.label', { name: value })
        }
    }

    const weeksWithEvents = useMemo(() => {
        const months = new Map<string, { year: number; month: number }>()
        filtered.forEach((event) => {
            const span = eventSpan(event)
            if (!span) return
            const key = `${span.start.getFullYear()}-${span.start.getMonth()}`
            months.set(key, { year: span.start.getFullYear(), month: span.start.getMonth() })
        })
        return Array.from(months.values()).sort((a, b) => a.year - b.year || a.month - b.month)
    }, [filtered])

    const freeWeekendList = useMemo(
        () => freeWeekends(allEvents, today, seasonEnd),
        [allEvents, today, seasonEnd],
    )

    const remaining = page ? Math.max(0, page.totalAmount - page.events.length) : 0
    const nextEvent = allEvents.find((event) => event.id === nextId)
    const nextSpan = nextEvent ? eventSpan(nextEvent) : undefined

    return (
        <>
            <OpenGraphMeta
                title={t('Calendar.pageTitle')}
                description={t('Calendar.pageDescription')}
                image="/images/lk-logo.png"
            />
            <div className={classes.row} data-testid={componentTestIds.calendar.panel}>
                <WidthFixer className={loading ? classes.loading : undefined}>
                    <div className={classes.head}>
                        <div>
                            <h1 className={classes.title}>{t('Calendar.pageTitle')}</h1>
                            <div className={classes.subtitle} data-testid={componentTestIds.calendar.summary}>
                                {t('Calendar.todayLine', { date: formatDate(today) })}
                                {stats && page && (
                                    <>
                                        {' · '}
                                        {t('Calendar.summary', {
                                            count: filtered.length,
                                            total: page.totalAmount,
                                        })}
                                        {nextEvent && nextSpan && (
                                            <>
                                                {' · '}
                                                <span className={classes.strong}>{nextEvent.name}</span>{' '}
                                                {t('Calendar.nearestEvent', {
                                                    date: formatDate(nextSpan.start),
                                                })}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <div className={classes.actions}>
                            <button
                                type="button"
                                className={classes.button}
                                onClick={() => routes.push(routes.eventCreate())}
                                data-testid={componentTestIds.calendar.addEvent}
                            >
                                {t('Calendar.addEvent')}
                            </button>
                            <a className={`${classes.button} ${classes.buttonGhost}`} href="/ical" target="_blank" rel="noreferrer">
                                {t('Calendar.subscribe')}
                            </a>
                        </div>
                    </div>

                    <SeasonStrip
                        months={seasonMonths}
                        selectedMonth={state.when === 'month' ? state.month : undefined}
                        onSelect={(key) => updateState({ when: 'month', month: key })}
                        hintKey="Calendar.stripHint"
                    />

                    <Row>
                        <Col lg={3} md={4} xs={12}>
                            <aside className={classes.side} data-testid={componentTestIds.calendar.filters}>
                                <div className={classes.filterGroup}>
                                    <h4 className={classes.filterTitle}>{t('Calendar.filters.when')}</h4>
                                    <label className={classes.filter}>
                                        <input
                                            type="radio"
                                            name="calendar-when"
                                            checked={state.when === 'all'}
                                            onChange={() => updateState({ when: 'all', month: undefined })}
                                        />
                                        <span>{t('Calendar.filters.when_all')}</span>
                                        <span className={classes.filterCount}>{allEvents.length}</span>
                                    </label>
                                    {CALENDAR_WHENS.filter((when) => when !== 'all').map((when) => (
                                        <label className={classes.filter} key={when}>
                                            <input
                                                type="radio"
                                                name="calendar-when"
                                                checked={state.when === when}
                                                onChange={() => updateState({ when })}
                                            />
                                            <span>{t(`Calendar.filters.when_${when}`)}</span>
                                            <span className={classes.filterCount}>{windowCount(when)}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className={classes.filterGroup}>
                                    <h4 className={classes.filterTitle}>{t('Calendar.filters.duration')}</h4>
                                    {CALENDAR_DURATIONS.map((duration: CalendarDuration) => (
                                        <label className={classes.filter} key={duration}>
                                            <input
                                                type="checkbox"
                                                checked={state.durations.includes(duration)}
                                                onChange={() => commitState(toggleDuration(state, duration))}
                                            />
                                            <span>{t(`Calendar.filters.duration_${duration}`)}</span>
                                            <span className={classes.filterCount}>
                                                {countFor((event) => {
                                                    const span = eventSpan(event)
                                                    return span ? durationBucket(span) === duration : false
                                                })}
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                <div className={classes.filterGroup}>
                                    <h4 className={classes.filterTitle}>{t('Calendar.filters.place')}</h4>
                                    {CALENDAR_PLACES.map((place: CalendarPlace) => (
                                        <label className={classes.filter} key={place}>
                                            <input
                                                type="checkbox"
                                                checked={state.places.includes(place)}
                                                onChange={() => commitState(togglePlace(state, place))}
                                            />
                                            <span>{t(`Calendar.filters.place_${place}`)}</span>
                                            <span className={classes.filterCount}>
                                                {countFor((event) => eventPlace(event) === place)}
                                            </span>
                                        </label>
                                    ))}
                                    <p className={classes.hint}>{t('Calendar.filters.placeHeuristic')}</p>
                                </div>

                                <div className={classes.filterGroup}>
                                    <h4 className={classes.filterTitle}>{t('Calendar.filters.status')}</h4>
                                    <label className={classes.filter}>
                                        <input
                                            type="checkbox"
                                            checked={state.withWeb}
                                            onChange={() => updateState({ withWeb: !state.withWeb })}
                                        />
                                        <span>{t('Calendar.filters.withWeb')}</span>
                                        <span className={classes.filterCount}>
                                            {countFor((event) => Boolean(event.web))}
                                        </span>
                                    </label>
                                    <label className={`${classes.filter} ${classes.filterDisabled}`}>
                                        <input type="checkbox" disabled />
                                        <span>{t('Calendar.filters.registrationOpen')}</span>
                                        <span className={classes.filterCount}>
                                            {allEvents.filter((event) => event.registrationOpen && event.registrationUrl).length}
                                        </span>
                                    </label>
                                    <p className={classes.hint}>{t('Calendar.filters.registrationNone')}</p>
                                </div>

                                <div className={classes.filterGroup}>
                                    <h4 className={classes.filterTitle}>{t('Calendar.filters.labels')}</h4>
                                    {labelFacets.length === 0 && (
                                        <p className={classes.hint}>
                                            {t('Calendar.filters.labelsNone', { total: allEvents.length })}
                                        </p>
                                    )}
                                    {labelFacets.map((label) => (
                                        <label className={classes.filter} key={label.id}>
                                            <input
                                                type="checkbox"
                                                checked={state.labels.includes(label.id)}
                                                onChange={() => commitState(toggleLabel(state, label.id))}
                                            />
                                            <span>{label.name}</span>
                                            <span className={classes.filterCount}>{label.count}</span>
                                        </label>
                                    ))}
                                    {state.labels.length > 1 && (
                                        <label className={classes.filter}>
                                            <input
                                                type="checkbox"
                                                checked={state.labelMode === 'any'}
                                                onChange={() =>
                                                    updateState({ labelMode: state.labelMode === 'any' ? 'all' : 'any' })
                                                }
                                            />
                                            <span>{t('Calendar.filters.labelsModeAny')}</span>
                                        </label>
                                    )}
                                </div>
                            </aside>
                        </Col>

                        <Col lg={9} md={8} xs={12}>
                            <div className={classes.switch} data-testid={componentTestIds.calendar.viewSwitch}>
                                {CALENDAR_VIEWS.map((view) => (
                                    <button
                                        type="button"
                                        key={view}
                                        className={`${classes.switchButton} ${
                                            state.view === view ? classes.switchButtonActive : ''
                                        }`}
                                        onClick={() =>
                                            updateState({ view, year: view === 'historie' ? state.year : undefined })
                                        }
                                        data-testid={componentTestIds.calendar.view(view)}
                                    >
                                        {t(`Calendar.views.${view}`)}
                                    </button>
                                ))}
                            </div>

                            <div className={classes.toolbar}>
                                <span data-testid={componentTestIds.calendar.resultCount}>
                                    {t('Calendar.resultCount', { count: filtered.length })}
                                </span>
                                <span>
                                    {t('Calendar.freeWeekendLine', {
                                        range: freeWeekendList.length
                                            ? `${freeWeekendList[0].saturday.getDate()}.–${freeWeekendList[0].sunday.getDate()}. ${monthName(
                                                  t,
                                                  freeWeekendList[0].sunday.getMonth(),
                                              )}`
                                            : '—',
                                        count: freeWeekendList.length,
                                    })}
                                </span>
                                <div className={classes.chips}>
                                    {activeFilters.map((filter) => (
                                        <button
                                            type="button"
                                            key={filter.key}
                                            className={classes.chip}
                                            onClick={() => updateState(filter.remove)}
                                        >
                                            {filterText(filter.kind, filter.value)}
                                            <span aria-hidden="true">✕</span>
                                        </button>
                                    ))}
                                    {hasCalendarFilters(state) && (
                                        <button
                                            type="button"
                                            className={classes.chip}
                                            onClick={() => commitState(clearCalendarFilters(state))}
                                            data-testid={componentTestIds.calendar.reset}
                                        >
                                            {t('Calendar.resetAll')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!page && <BigLoading />}

                            {page && (
                                <>
                                    {state.view === 'vikendy' && filtered.length > 0 && (
                                        <WeekendAgenda
                                            events={filtered}
                                            today={today}
                                            until={seasonEnd}
                                            nextEventId={nextId}
                                        />
                                    )}

                                    {state.view === 'mesic' &&
                                        weeksWithEvents.map((item) => (
                                            <MonthGrid
                                                key={`${item.year}-${item.month}`}
                                                year={item.year}
                                                month={item.month}
                                                events={filtered}
                                                today={today}
                                            />
                                        ))}

                                    {state.view === 'historie' && (
                                        <HistoryView
                                            byMonth={stats?.byMonth ?? []}
                                            totalAmount={stats?.totalAmount ?? 0}
                                            today={today}
                                            selectedYear={selectedYear}
                                            onSelectYear={(year) => updateState({ year })}
                                            yearEvents={yearPage?.events ?? []}
                                            loadingYear={loadingYear}
                                            hasMoreYear={Boolean(
                                                yearPage && yearPage.totalAmount > yearPage.events.length,
                                            )}
                                            onLoadMoreYear={handleLoadMoreYear}
                                        />
                                    )}

                                    {filtered.length === 0 && state.view !== 'historie' && (
                                        <div className={classes.empty} data-testid={componentTestIds.calendar.empty}>
                                            {t('Calendar.empty')}
                                            <div>
                                                <button
                                                    type="button"
                                                    className={classes.button}
                                                    onClick={() => commitState(clearCalendarFilters(state))}
                                                >
                                                    {t('Calendar.resetAll')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {remaining > 0 && (
                                        <div className={classes.more}>
                                            <button
                                                type="button"
                                                className={classes.button}
                                                onClick={handleLoadMore}
                                                disabled={loadingMore}
                                                data-testid={componentTestIds.calendar.loadMore}
                                            >
                                                {loadingMore
                                                    ? t('Calendar.loading')
                                                    : t('Calendar.loadMore', {
                                                          count: Math.min(PAGE_SIZE, remaining),
                                                      })}
                                            </button>
                                        </div>
                                    )}

                                    {state.view !== 'historie' && filtered.length > 0 && (
                                        <div className={classes.hint}>{t('Calendar.subscribeHint')}</div>
                                    )}

                                    {state.view === 'vikendy' &&
                                        filtered.length > 0 &&
                                        filtered.length < 6 &&
                                        allEvents.length > filtered.length && (
                                            <div className={classes.hint}>{t('Calendar.filteredHint')}</div>
                                        )}
                                </>
                            )}
                        </Col>
                    </Row>
                </WidthFixer>
            </div>
        </>
    )
}

export default CalendarPanel
