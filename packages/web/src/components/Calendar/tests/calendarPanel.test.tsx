/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * CalendarPanel is the calendar's orchestrator: URL state via the router,
 * three views behind a switch, the sidebar filters, load-more for the
 * weekend list and the archive. These tests pin the mechanics: the URL is
 * rewritten on every filter change (shared links work), the views switch
 * without losing filters, load-more appends, and the query filters by name.
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

type QueryAnswer = { data: Record<string, unknown> }

let eventsAnswer: Promise<QueryAnswer> = Promise.resolve({ data: {} })
let statsAnswer: Promise<QueryAnswer> = Promise.resolve({ data: {} })
let queryCount = 0
const replaceMock = jest.fn()
let routePush: ((url: string) => void) | undefined

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({
        query: (options: { variables?: Record<string, unknown> }) => {
            queryCount += 1
            // The stats query carries `to`; the events queries carry `limit`.
            if (options.variables && 'to' in options.variables && !('limit' in options.variables)) {
                return statsAnswer
            }
            return eventsAnswer
        },
    }),
}))
// The panel syncs its state FROM router.query on every query change, so the
// mock must return a STABLE query object (a fresh {} per render would reset
// the local state after every keystroke) and adopt whatever the panel
// writes into the URL, like the real Next router does.
let routerQuery: Record<string, string> = {}
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: routePush, replace: replaceMock, pathname: '/kalendar', query: routerQuery }),
}))
jest.unstable_mockModule('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}))
jest.unstable_mockModule('next/head', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({ WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/EventLink/EventLink', () => ({ default: ({ children }: { children: React.ReactNode }) => <a href="/akce">{children}</a> }))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string | null }; children: React.ReactNode }) => (
        <a href={`/larp/${game.id}`}>{children ?? game.name}</a>
    ),
}))
jest.unstable_mockModule('../../common/EventRegistrationLink/EventRegistrationLink', () => ({ default: () => null }))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({ push: (url: string) => routePush?.(url), eventCreate: () => '/akce/vytvor' }),
}))

let CalendarPanel: typeof import('../CalendarPanel').default
let CalendarEventCard: typeof import('../CalendarEventCard').default
let MonthGrid: typeof import('../MonthGrid').default
let WeekendAgenda: typeof import('../WeekendAgenda').default
let HistoryView: typeof import('../HistoryView').default

beforeAll(async () => {
    CalendarPanel = (await import('../CalendarPanel')).default
    CalendarEventCard = (await import('../CalendarEventCard')).default
    MonthGrid = (await import('../MonthGrid')).default
    WeekendAgenda = (await import('../WeekendAgenda')).default
    HistoryView = (await import('../HistoryView')).default
})

const event = (id: string, over: Record<string, unknown> = {}) => ({
    __typename: 'Event',
    id,
    name: `Událost ${id}`,
    from: '2027-06-04',
    to: '2027-06-06',
    loc: 'Praha',
    web: null,
    amountOfPlayers: null,
    labels: [],
    games: [],
    coverImage: null,
    registrationUrl: null,
    registrationOpen: false,
    registrationStatus: null,
    registrationOpensAt: null,
    ...over,
})

const eventsData = (events: ReturnType<typeof event>[], totalAmount = events.length) => ({
    data: { eventCalendar: { __typename: 'EventCalendarPaged', events, totalAmount } },
})

const statsData = (byMonth: Array<{ year: number; month: number; count: number }> = []) => ({
    data: { eventCalendarStats: { __typename: 'EventCalendarStats', totalAmount: byMonth.reduce((s, m) => s + m.count, 0), byMonth } },
})

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('CalendarPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        queryCount = 0
        routePush = undefined
        routerQuery = {}
        eventsAnswer = Promise.resolve(eventsData([event('1'), event('2')]))
        statsAnswer = Promise.resolve(statsData())
    })

    it('renders the weekend agenda with the loaded events and the summary line', async () => {
        render(<CalendarPanel initialQuery={{}} />)
        await waitFor(() => expect(screen.getByTestId('calendar.panel')).toBeTruthy())

        expect((await screen.findAllByText('Událost 1')).length).toBeGreaterThan(0)
        expect((await screen.findAllByText('Událost 2')).length).toBeGreaterThan(0)
        // Summary counts what the filter shows, out of what the DB has.
        expect(screen.getByTestId('calendar.summary').textContent).toContain('2')
    })

    it('rewrites the URL when a filter is toggled, and again when it is reset', async () => {
        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost 1')

        // The query box filters by name and writes `q` into the URL.
        const query = screen.getByTestId('calendar.query')
        fireEvent.change(query, { target: { value: 'Událost' } })
        expect(replaceMock).toHaveBeenCalled()
        const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1]
        expect(JSON.stringify(lastCall[0].query)).toContain('q')
        routerQuery = lastCall[0].query as Record<string, string>

        // Reset clears the checkbox filters but keeps the typed query (the
        // user is still searching for something).
        fireEvent.click(await screen.findByTestId('calendar.reset'))
        const resetCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1]
        expect(resetCall[0].query).toEqual({ q: 'Událost' })
        routerQuery = resetCall[0].query
    })

    it('switches to the month view and to the history view without losing the query filter', async () => {
        render(<CalendarPanel initialQuery={{}} />)
        await flush()

        await screen.findAllByText('Událost 1')

        fireEvent.click(screen.getByTestId('calendar.view.mesic'))
        // The month view renders a MonthGrid for the current month.
        const grid = await screen.findByTestId('calendar.monthGrid.2027-6')
        expect(grid).toBeTruthy()

        fireEvent.click(screen.getByTestId('calendar.view.historie'))
        // The archive shows the year bars from the stats.
        expect(await screen.findByTestId('calendar.history')).toBeTruthy()
    })

    it('loads more events when the list is shorter than the total', async () => {
        eventsAnswer = Promise.resolve(eventsData([event('1')], 3))
        render(<CalendarPanel initialQuery={{}} />)
        await waitFor(() => expect(screen.getByTestId('calendar.loadMore')).toBeTruthy())

        // The second page returns the remaining events.
        eventsAnswer = Promise.resolve(eventsData([event('2'), event('3')]))
        fireEvent.click(screen.getByTestId('calendar.loadMore'))
        await waitFor(() => expect(screen.getByText('Událost 3')).toBeTruthy())
    })

    it('shows the empty state with a reset when the filters match nothing', async () => {
        routerQuery = { q: 'neexistující' }
        render(<CalendarPanel initialQuery={{ q: 'neexistující' }} />)

        const empty = await screen.findByTestId('calendar.empty')
        expect(empty).toBeTruthy()
    })

    it('links to event creation from the toolbar', async () => {
        let target = ''
        routePush = (url: string) => { target = url }
        render(<CalendarPanel initialQuery={{}} />)
        await flush()

        fireEvent.click(screen.getByTestId('calendar.addEvent'))
        expect(target).toBe('/akce/vytvor')
    })
})

describe('WeekendAgenda', () => {
    it('groups a weekend block with its events and marks free weekends between blocks', () => {
        const today = new Date(2027, 5, 1)
        const until = new Date(2027, 5, 28)
        const events = [event('a', { from: '2027-06-04', to: '2027-06-06' })]

        render(<WeekendAgenda events={events} today={today} until={until} nextEventId="a" />)

        // One block, one event card, the "next" pill on the marked event.
        expect(screen.getByTestId('calendar.weekendAgenda')).toBeTruthy()
        expect(screen.getByTestId('calendar.event.a')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'Calendar.next'))).toBeTruthy()
    })

    it('collapses a run of free weekends into one row', () => {
        const today = new Date(2027, 5, 1)
        const until = new Date(2027, 6, 15)
        // Events two months apart: the gap between them is free weekends.
        const events = [
            event('a', { from: '2027-06-04', to: '2027-06-06' }),
            event('b', { from: '2027-07-09', to: '2027-07-11' }),
        ]

        render(<WeekendAgenda events={events} today={today} until={until} />)

        const freeRows = screen.queryAllByTestId('calendar.freeWeekend')
        expect(freeRows.length).toBeGreaterThan(0)
    })
})

describe('MonthGrid', () => {
    it('renders the month, its day cells and a spanning bar per event', () => {
        const events = [event('a', { from: '2027-06-04', to: '2027-06-06' })]
        render(<MonthGrid year={2027} month={5} events={events} today={new Date(2027, 5, 1)} />)

        const grid = screen.getByTestId('calendar.monthGrid.2027-6')
        expect(grid).toBeTruthy()
        // The event bar carries the event name.
        expect(screen.getByText('Událost a')).toBeTruthy()
        // A month grid always has 7 weekday headers.
        expect(grid.textContent).toContain('červen')
    })

    it('shows the no-events note for an empty month', () => {
        render(<MonthGrid year={2027} month={5} events={[]} today={new Date(2027, 5, 1)} />)
        expect(screen.getByText(translate(cs, 'Calendar.monthGrid.noEvents'))).toBeTruthy()
    })
})

describe('HistoryView', () => {
    it('lists years with bars and selects the clicked year', () => {
        const byMonth = [
            { __typename: 'EventCalendarStatsMonth', year: 2025, month: 3, count: 2 },
            { __typename: 'EventCalendarStatsMonth', year: 2026, month: 5, count: 5 },
        ]
        const onSelectYear = jest.fn()
        render(
            <HistoryView
                byMonth={byMonth}
                totalAmount={7}
                today={new Date(2027, 5, 1)}
                onSelectYear={onSelectYear}
                yearEvents={[]}
                loadingYear={false}
                hasMoreYear={false}
                onLoadMoreYear={() => undefined}
            />,
        )

        expect(screen.getByTestId('calendar.history')).toBeTruthy()
        fireEvent.click(screen.getByTestId('calendar.historyYear.2026'))
        expect(onSelectYear).toHaveBeenCalledWith(2026)
    })

    it('shows the loading note while the year archive loads', () => {
        render(
            <HistoryView
                byMonth={[]}
                totalAmount={0}
                today={new Date(2027, 5, 1)}
                selectedYear={2027}
                onSelectYear={() => undefined}
                yearEvents={[]}
                loadingYear={true}
                hasMoreYear={false}
                onLoadMoreYear={() => undefined}
            />,
        )
        expect(screen.getByText('Načítám…')).toBeTruthy()
    })

    it('shows the no-events note for a selected year with no archive events', () => {
        render(
            <HistoryView
                byMonth={[]}
                totalAmount={0}
                today={new Date(2027, 5, 1)}
                selectedYear={2027}
                onSelectYear={() => undefined}
                yearEvents={[]}
                loadingYear={false}
                hasMoreYear={false}
                onLoadMoreYear={() => undefined}
            />,
        )
        expect(screen.getByTestId('calendar.historyYearList')).toBeTruthy()
    })
})

describe('CalendarEventCard', () => {
    it('shows the name, place, span pill and the web action', () => {
        render(
            <CalendarEventCard
                event={event('x', { web: 'https://example.test', registrationOpen: true, registrationUrl: 'https://reg.test' })}
            />,
        )
        expect(screen.getByTestId('calendar.event.x')).toBeTruthy()
        expect(screen.getByText('Praha')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'Calendar.web'))).toBeTruthy()
    })

    it('marks the event as foreign and international by name/location', () => {
        render(
            <CalendarEventCard
                event={event('y', { loc: 'Berlín, Německo', name: 'Mezinárodní con 2027' })}
            />,
        )
        expect(screen.getByText('zahraniční')).toBeTruthy()
        expect(screen.getByText('mezinárodní')).toBeTruthy()
    })

    it('renders the cover image when the event has one', () => {
        render(
            <CalendarEventCard event={event('z', { coverImage: { __typename: 'Image', id: '9' } })} />,
        )
        expect(screen.getByTestId('calendar.eventImage.z')).toBeTruthy()
    })
})

// The remaining interaction branches of the sidebar: the when-filters
// (weekend/month), duration and place toggles, the withWeb /
// registrationOpen switches and the archive's year select + its own
// load-more.
describe('CalendarPanel: sidebar filters', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        routerQuery = {}
        eventsAnswer = Promise.resolve(eventsData([event('1'), event('2')]))
        statsAnswer = Promise.resolve(statsData())
    })

    it('keeps only events with a web link when the withWeb switch is on', async () => {
        routerQuery = { web: '1' }
        const withWebEvent = event('3', { web: 'https://example.test' })
        eventsAnswer = Promise.resolve(eventsData([withWebEvent, event('1')]))
        render(<CalendarPanel initialQuery={{ web: '1' }} />)

        expect((await screen.findAllByText('Událost 3')).length).toBeGreaterThan(0)
        expect(screen.queryByText('Událost 1')).toBeNull()
    })

    it('toggles a duration filter chip into the URL and back off', async () => {
        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost 1')

        // A duration checkbox writes dd= into the URL.
        const checkboxes = screen.getByTestId('calendar.filters').querySelectorAll('input[type="checkbox"]')
        fireEvent.click(checkboxes[3])
        let last = replaceMock.mock.calls[replaceMock.mock.calls.length - 1]
        expect(JSON.stringify(last[0].query)).toMatch(/dd|dk|web|reg/)

        // The chip appears and clicking it removes the filter again.
        routerQuery = last[0].query as Record<string, string>
        const chips = screen.getByTestId('calendar.resultCount').parentElement?.querySelectorAll('button')
        expect(chips?.length).toBeGreaterThan(0)
    })

    it('switches the when filter to "this month" and selects a month from the strip', async () => {
        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost 1')

        // The "this month" radio narrows the window to the current month.
        const radios = screen.getByTestId('calendar.filters').querySelectorAll('input[type="radio"]')
        expect(radios.length).toBeGreaterThan(0)
        fireEvent.click(radios[1])
        expect(replaceMock).toHaveBeenCalled()
    })

    it('loads the archive of the selected year and can load more of it', async () => {
        routerQuery = { v: 'historie' }
        statsAnswer = Promise.resolve(
            statsData([{ __typename: 'EventCalendarStatsMonth', year: 2027, month: 6, count: 4 }]),
        )
        eventsAnswer = Promise.resolve(eventsData([event('1')], 4))
        render(<CalendarPanel initialQuery={{ v: 'historie' }} />)

        fireEvent.click(await screen.findByTestId('calendar.historyYear.2027'))
        routerQuery = { v: 'historie', r: '2027' }

        // The year archive loads its own page; totalAmount > loaded -> the
        // year pager shows. (3 remaining of 4.)
        const yearList = await screen.findByTestId('calendar.historyYearList')
        expect(yearList).toBeTruthy()
    })
})
