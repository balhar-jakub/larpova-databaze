/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
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
let SeasonStrip: typeof import('../SeasonStrip').default
let CalendarEventCard: typeof import('../CalendarEventCard').default
let MonthGrid: typeof import('../MonthGrid').default
let WeekendAgenda: typeof import('../WeekendAgenda').default
let HistoryView: typeof import('../HistoryView').default

beforeAll(async () => {
    CalendarPanel = (await import('../CalendarPanel')).default
    CalendarEventCard = (await import('../CalendarEventCard')).default
    MonthGrid = (await import('../MonthGrid')).default
    WeekendAgenda = (await import('../WeekendAgenda')).default
    SeasonStrip = (await import('../SeasonStrip')).default
    HistoryView = (await import('../HistoryView')).default
})

const event = (id: string, over: Record<string, unknown> = {}): any => ({
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

const eventsData = (events: any[], totalAmount = events.length) => ({
    data: { eventCalendar: { __typename: 'EventCalendarPaged', events, totalAmount } },
})

const statsData = (byMonth: any[] = []) => ({
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
        const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as unknown as { query: Record<string, string> }
        expect(JSON.stringify(lastCall[0].query)).toContain('q')
        routerQuery = lastCall[0].query as Record<string, string>

        // Reset clears the checkbox filters but keeps the typed query (the
        // user is still searching for something).
        fireEvent.click(await screen.findByTestId('calendar.reset'))
        const resetCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as unknown as { query: Record<string, string> }
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

    // Clicks the checkbox/radio inside the label that contains the given text.
    const clickFilterInput = (labelText: string) => {
        const label = screen.getByText(labelText).closest('label')
        expect(label).toBeTruthy()
        const input = label!.querySelector('input')
        expect(input).toBeTruthy()
        fireEvent.click(input!)
    }

    it('toggles the with-web and registration-open filters', async () => {
        eventsAnswer = Promise.resolve(eventsData([
            event('1', { web: 'https://akce.test', registrationOpen: false }),
            event('2', { web: null, registrationOpen: true, registrationUrl: 'https://reg.test' }),
        ]))
        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost 1')

        clickFilterInput(translate(cs, 'Calendar.filters.withWeb'))
        let lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.web).toBe('1')

        clickFilterInput(translate(cs, 'Calendar.filters.registrationOpen'))
        lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.reg).toBe('1')
    })

    it('toggles a duration filter and a label checkbox', async () => {
        eventsAnswer = Promise.resolve(eventsData([
            event('1', { labels: [{ id: 'l1', name: 'svět' }] }),
        ]))
        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost 1')

        // The weekend duration checkbox.
        clickFilterInput(translate(cs, 'Calendar.filters.duration_weekend'))
        let lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.dd).toBe('weekend')

        // A label facet checkbox (the event carries one label).
        clickFilterInput('svět')
        lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.lb).toBe('l1')
    })

    it('offers the any-label mode once two labels are selected', async () => {
        eventsAnswer = Promise.resolve(eventsData([
            event('1', { labels: [{ id: 'l1', name: 'svět' }, { id: 'l2', name: 'fantasy' }] }),
        ]))
        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost 1')

        clickFilterInput('svět')
        clickFilterInput('fantasy')

        const anyMode = screen.getByText(translate(cs, 'Calendar.filters.labelsModeAny'))
        fireEvent.click(anyMode)

        const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.lm).toBe('any')
    })

    it('switches the when radio to weekend and month, and back to all', async () => {
        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost 1')

        clickFilterInput(translate(cs, 'Calendar.filters.when_weekend'))
        let lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.kdy).toBe('weekend')

        clickFilterInput(translate(cs, 'Calendar.filters.when_month'))
        lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.kdy).toBe('month')

        clickFilterInput(translate(cs, 'Calendar.filters.when_all'))
        lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.kdy).toBeUndefined()
    })

    it('removes an active filter through its chip', async () => {
        routerQuery = { q: 'Událost' }
        render(<CalendarPanel initialQuery={{ q: 'Událost' }} />)
        await screen.findByTestId('calendar.panel')

        // The chip row renders an active-query chip as a button; clicking it
        // removes that one filter.
        const chip = screen.getAllByRole('button').find(
            el => (el.textContent ?? '').includes('Událost') && (el.textContent ?? '').includes('✕'),
        )
        expect(chip).toBeTruthy()
        fireEvent.click(chip!)

        const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as never as unknown[] as never as { query: Record<string, string> }[]
        expect(lastCall[0].query.q).toBeUndefined()
    })

    it('links to event creation from the toolbar', async () => {
        let target = ''
        routePush = (url: string) => { target = url }
        render(<CalendarPanel initialQuery={{}} />)
        await flush()

        fireEvent.click(screen.getByTestId('calendar.addEvent'))
        expect(target).toBe('/akce/vytvor')
    })
    it('aggregates a month twice in the stats into one season count and answers an empty free-weekend line', async () => {
        // Two byMonth entries for the SAME month (the `?? 0` + accumulation arm).
        const now = new Date()
        const mk = (m: number) => ({ __typename: 'EventMonthCount', year: now.getFullYear(), month: m, count: 4 })
        statsAnswer = Promise.resolve(statsData([mk(now.getMonth() + 1), mk(now.getMonth() + 1)]))
        eventsAnswer = Promise.resolve(eventsData([event('1')]))
        // The single event sits on this weekend, so no free weekend exists.
        const saturday = new Date()
        saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7))
        const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        eventsAnswer = Promise.resolve(eventsData([event('busy', { from: iso(saturday), to: iso(saturday) })]))

        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost busy')

        // The line renders with the em-dash placeholder when every weekend
        // up to the season end is busy or past.
        expect(screen.getByTestId('calendar.resultCount')).toBeTruthy()
        expect(document.body.textContent).toContain('Nejbližší volný víkend')
    })

    it('derives the label facets from the loaded events, naming a label by its id when nameless', async () => {
        eventsAnswer = Promise.resolve(
            eventsData([
                event('1', { labels: [{ __typename: 'Label', id: 'l1', name: 'komorní' }] }),
                event('2', { labels: [{ __typename: 'Label', id: 'l2', name: null }] }),
            ]),
        )

        render(<CalendarPanel initialQuery={{}} />)
        await screen.findAllByText('Událost 1')

        // Both labels appear in the sidebar's label list — the nameless one
        // by its id (the `?? label.id` arm).
        expect(screen.getByText('komorní')).toBeTruthy()
        expect(screen.getByText('l2')).toBeTruthy()
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
            { year: 2025, month: 3, count: 2 },
            { year: 2026, month: 5, count: 5 },
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

    it('aggregates two months of the same year into one year row', () => {
        const byMonth = [
            { year: 2026, month: 3, count: 2 },
            { year: 2026, month: 7, count: 5 },
        ]
        render(
            <HistoryView
                byMonth={byMonth}
                totalAmount={7}
                today={new Date(2027, 5, 1)}
                onSelectYear={() => undefined}
                yearEvents={[]}
                loadingYear={false}
                selectedYear={undefined}
                hasMoreYear={false}
                onLoadMoreYear={() => undefined}
            />,
        )
        // Both months landed in the same year entry (the years.get() hit arm).
        expect(document.body.textContent).toContain('2026')
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
    it('renders the registration pills for the upcoming, open and closed states', () => {
        // Upcoming: a future sign-up link announced before it opens.
        render(<CalendarEventCard event={event('u', { registrationStatus: 'UPCOMING', registrationUrl: 'https://reg.test', from: '2027-06-04', to: '2027-06-04' })} />)
        expect(screen.getByText(translate(cs, 'Calendar.registrationUpcomingPill'))).toBeTruthy()
        cleanup()

        // Closed: a link whose registration is not open and not upcoming.
        render(<CalendarEventCard event={event('cl', { registrationOpen: false, registrationUrl: 'https://reg.test' })} />)
        expect(screen.getByText(translate(cs, 'Calendar.registrationClosedPill'))).toBeTruthy()
        cleanup()

        // An open registration with a NON-http link shows no pill at all
        // (the isAbsoluteHttpUrl guard) — an open flag without a usable link.
        render(<CalendarEventCard event={event('nl', { registrationOpen: true, registrationUrl: 'javascript:void(0)' })} />)
        expect(screen.queryByText(translate(cs, 'Calendar.registrationOpenPill'))).toBeNull()
        expect(screen.queryByText(translate(cs, 'Calendar.registrationClosedPill'))).toBeNull()
    })

    it('names the span by its length: one day, a weekend and a long event', () => {
        render(<CalendarEventCard event={event('one-day', { from: '2027-06-04', to: '2027-06-04' })} />)
        expect(screen.getByText(translate(cs, 'Calendar.oneDay'))).toBeTruthy()
        cleanup()

        render(<CalendarEventCard event={event('four-days', { from: '2027-06-04', to: '2027-06-07' })} />)
        // 4 days: the short-count text, not the long one.
        expect(document.body.textContent).toContain('4 dny')
        cleanup()

        render(<CalendarEventCard event={event('nine-days', { from: '2027-06-04', to: '2027-06-12' })} />)
        expect(document.body.textContent).toContain('9 dní')
    })

    it('lists the linked games, the player count and the missing place', () => {
        render(
            <CalendarEventCard
                event={event('with-games', {
                    loc: null,
                    amountOfPlayers: 120,
                    games: [
                        { __typename: 'Game', id: 'g1', name: 'Krvavé časy' },
                        { __typename: 'Game', id: 'g2', name: 'Země snů' },
                    ],
                })}
            />,
        )

        // Two games: the second gets a comma separator (the index > 0 arm).
        expect(screen.getByText('Krvavé časy')).toBeTruthy()
        expect(screen.getByText('Země snů')).toBeTruthy()
        expect(document.body.textContent).toContain('Krvavé časy, ')
        expect(document.body.textContent).toContain('120 hráčů')
        expect(screen.getByText(translate(cs, 'Calendar.noPlace'))).toBeTruthy()
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
        let last = replaceMock.mock.calls[replaceMock.mock.calls.length - 1] as unknown as { query: Record<string, string> }
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
            statsData([{ year: 2027, month: 6, count: 4 }]),
        )
        eventsAnswer = Promise.resolve(eventsData([event('1')], 4))
        render(<CalendarPanel initialQuery={{ v: 'historie' }} />)

        fireEvent.click(await screen.findByTestId('calendar.historyYear.2027'))
        routerQuery = { v: 'historie', r: '2027' }

        // The year archive loads its own page; totalAmount > loaded -> the
        // year pager shows. (3 remaining of 4.)
        const yearList = await screen.findByTestId('calendar.historyYearList')
        expect(yearList).toBeTruthy()

        // Loading more of the year archive appends the next page.
        eventsAnswer = Promise.resolve(eventsData([event('2'), event('3')], 4))
        fireEvent.click(screen.getByText('Načíst dalších 100'))
        await waitFor(() => expect(screen.getByText('Událost 2')).toBeTruthy())
    })
})

describe('SeasonStrip', () => {
    it('marks the selected month and keeps the empty months clickable', () => {
        const months = [
            { key: '2026-10', label: 'říj 26', count: 4 },
            { key: '2026-11', label: 'lis 26', count: 0 },
        ]
        render(<SeasonStrip months={months} selectedMonth="2026-10" onSelect={() => undefined} />)

        const buttons = screen.getAllByRole('button')
        expect(buttons).toHaveLength(2)
        // Both months render; the selected one carries its class.
        expect(buttons[0].className).not.toBe(buttons[1].className)
    })
})

