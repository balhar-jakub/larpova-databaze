import { CalendarEventDataFragment } from '../../../graphql/__generated__/typescript-operations'
import { parseCalendarState } from '../calendarState'
import {
    buildMonthGrid,
    durationBucket,
    eventPlace,
    eventSpan,
    filterCalendarEvents,
    freeWeekends,
    googleCalendarUrl,
    groupEventsByWeek,
    nextEventId,
    relativeHint,
} from '../calendarUtils'

/** Event dates are stored at 00:00 UTC and reach the client as epoch millis. */
const at = (year: number, month: number, day: number) => String(Date.UTC(year, month - 1, day))

const event = (
    id: string,
    name: string,
    from: string | null,
    to: string | null,
    extra: Partial<CalendarEventDataFragment> = {},
): CalendarEventDataFragment =>
    ({
        __typename: 'Event',
        id,
        name,
        from,
        to,
        loc: null,
        web: null,
        registrationUrl: null,
        registrationOpen: false,
        amountOfPlayers: null,
        labels: [],
        games: [],
        ...extra,
    } as CalendarEventDataFragment)

// October 2026: 3rd and 10th and 24th are Saturdays, 8th and 15th Thursdays.
const today = new Date(2026, 9, 2)
const the3rd = event('a', 'Cosplay Night Ball', at(2026, 10, 3), at(2026, 10, 3), { loc: 'Praha' })
const the8th = event('b', 'Na vlastní kůži', at(2026, 10, 8), at(2026, 10, 10))
const camlann = event('c', 'Camlann (mezinárodní)', at(2026, 10, 15), at(2026, 10, 18), {
    loc: 'hrad Lipnice',
    web: 'https://example.com',
})
const abroad = event('d', 'Blank Space', at(2026, 10, 17), at(2026, 10, 18), { loc: 'Německo – Erndtebrück' })
const late = event('e', 'Cyberpunk London', at(2026, 10, 24), at(2026, 10, 24), { loc: 'Londýn' })

describe('eventSpan', () => {
    test('counts both the first and the last day', () => {
        expect(eventSpan(camlann)?.days).toBe(4)
        expect(eventSpan(the3rd)?.days).toBe(1)
    })

    test('an event whose end is before its start counts as one day', () => {
        // 30 archive events carry to < from, up to −29 days; they must not
        // produce a negative length.
        const broken = event('x', 'Broken', at(2026, 10, 20), at(2026, 9, 21))

        expect(eventSpan(broken)?.days).toBe(1)
    })

    test('an event without a date has no span at all', () => {
        expect(eventSpan(event('y', 'No date', null, null))).toBeUndefined()
    })

    test('lengths fall into the three buckets of the filter', () => {
        expect(durationBucket(eventSpan(the3rd)!)).toBe('one')
        expect(durationBucket(eventSpan(camlann)!)).toBe('weekend')
        expect(durationBucket(eventSpan(event('z', 'Long', at(2026, 10, 1), at(2026, 10, 11)))!)).toBe('long')
    })
})

describe('eventPlace', () => {
    test('separates Czech, foreign and missing locations', () => {
        expect(eventPlace(the3rd)).toBe('cz')
        expect(eventPlace(late)).toBe('foreign')
        expect(eventPlace(abroad)).toBe('foreign')
        expect(eventPlace(the8th)).toBe('noloc')
    })

    test('the international marker counts as foreign even without a location', () => {
        expect(eventPlace(event('i', 'Erebos (mezinárodní)', at(2026, 10, 1), null))).toBe('foreign')
    })
})

describe('filterCalendarEvents', () => {
    const all = [the3rd, the8th, camlann, abroad, late]
    const of = (query: Parameters<typeof parseCalendarState>[0]) =>
        filterCalendarEvents(all, parseCalendarState(query), today).map((item) => item.id)

    test('no filter keeps everything', () => {
        expect(of({})).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    test('"this weekend" is the Saturday and Sunday that come next', () => {
        expect(of({ kdy: 'weekend' })).toEqual(['a'])
        expect(of({ kdy: 'nextweekend' })).toEqual(['b'])
    })

    test('a selected month keeps only its events', () => {
        expect(of({ kdy: 'month', m: '2026-10' })).toEqual(['a', 'b', 'c', 'd', 'e'])
        expect(of({ kdy: 'month', m: '2026-11' })).toEqual([])
    })

    test('length, place and web filters combine', () => {
        expect(of({ dd: 'one' })).toEqual(['a', 'e'])
        expect(of({ dk: 'foreign' })).toEqual(['c', 'd', 'e'])
        expect(of({ web: '1' })).toEqual(['c'])
        expect(of({ dd: 'weekend' })).toEqual(['b', 'c', 'd'])
        expect(of({ dd: 'weekend', dk: 'noloc' })).toEqual(['b'])
    })

    test('the open-registration filter keeps only sign-up-able events', () => {
        // One event with an open registration and a link, one with the flag
        // but no link (a legacy row), one closed with a link.
        const signable = event('r1', 'Otevřený běh', at(2026, 10, 3), at(2026, 10, 3), {
            registrationUrl: 'https://example.test/form',
            registrationOpen: true,
        })
        const noLink = event('r2', 'Bez odkazu', at(2026, 10, 4), at(2026, 10, 4), {
            registrationOpen: true,
        })
        const closed = event('r3', 'Uzavřený běh', at(2026, 10, 5), at(2026, 10, 5), {
            registrationUrl: 'https://example.test/form-closed',
            registrationOpen: false,
        })

        expect(
            filterCalendarEvents([signable, noLink, closed], parseCalendarState({ reg: '1' }), today).map(
                (item) => item.id,
            ),
        ).toEqual(['r1'])
        // Without the filter everything stays.
        expect(filterCalendarEvents([signable, noLink, closed], parseCalendarState({}), today)).toHaveLength(3)
    })

    test('label filters can require all or any of the labels', () => {
        const labelled = [
            event('l1', 'One', at(2026, 10, 3), at(2026, 10, 3), { labels: [{ __typename: 'Label', id: '1', name: 'komorní' }] }),
            event('l2', 'Two', at(2026, 10, 4), at(2026, 10, 4), {
                labels: [
                    { __typename: 'Label', id: '1', name: 'komorní' },
                    { __typename: 'Label', id: '2', name: 'dřevárna' },
                ],
            }),
        ]

        expect(filterCalendarEvents(labelled, parseCalendarState({ lb: '2' }), today).map((item) => item.id)).toEqual([
            'l2',
        ])
        expect(
            filterCalendarEvents(labelled, parseCalendarState({ lb: '1,2' }), today).map((item) => item.id),
        ).toEqual(['l2'])
        expect(
            filterCalendarEvents(labelled, parseCalendarState({ lb: '1,2', lm: 'any' }), today).map((item) => item.id),
        ).toEqual(['l1', 'l2'])
    })
})

describe('groupEventsByWeek', () => {
    test('events of one week end up in one block, ordered by date', () => {
        const blocks = groupEventsByWeek([the8th, the3rd])

        expect(blocks.map((block) => block.events.map((item) => item.id))).toEqual([['a'], ['b']])
        expect(blocks[0].from.getDate()).toBe(3)
    })

    test('a week with two events keeps both in the same block', () => {
        const blocks = groupEventsByWeek([camlann, abroad])

        expect(blocks).toHaveLength(1)
        expect(blocks[0].events.map((item) => item.id)).toEqual(['c', 'd'])
    })
})

describe('freeWeekends', () => {
    test('weekends with an event are not listed, empty ones are', () => {
        const free = freeWeekends([the3rd, the8th, camlann, abroad, late], today, new Date(2026, 10, 30))

        expect(free.map((weekend) => weekend.saturday.getDate())).toEqual([31, 7, 14, 21, 28])
    })
})

describe('buildMonthGrid', () => {
    test('a Thursday to Sunday event is one bar across four columns', () => {
        const grid = buildMonthGrid(2026, 9, [camlann])
        const week = grid.weeks.find((item) => item.days[0].getDate() === 12)

        expect(week?.bars).toHaveLength(1)
        expect(week?.bars[0].columnStart).toBe(3)
        expect(week?.bars[0].columnEnd).toBe(6)
        expect(week?.bars[0].lane).toBe(0)
    })

    test('overlapping events get their own lane', () => {
        const grid = buildMonthGrid(2026, 9, [camlann, abroad])
        const week = grid.weeks.find((item) => item.days[0].getDate() === 12)

        expect(week?.lanes).toBe(2)
        expect(week?.bars.map((bar) => bar.lane)).toEqual([0, 1])
    })

    test('one-day events stay inside their column', () => {
        const grid = buildMonthGrid(2026, 9, [the3rd])
        const week = grid.weeks.find((item) => item.days[0].getDate() === 28)
        const bar = week?.bars[0]

        expect(bar?.columnStart).toBe(bar?.columnEnd)
    })

    test('the grid covers the whole month, including the days of the neighbours', () => {
        const grid = buildMonthGrid(2026, 9, [])

        expect(grid.weeks[0].days[0].getDate()).toBe(28)
        expect(grid.weeks[grid.weeks.length - 1].days[6].getDate()).toBe(1)
    })
})

describe('links and hints', () => {
    test('the Google Calendar link spans the last day too', () => {
        const url = googleCalendarUrl(camlann)!

        expect(url).toContain('dates=20261015%2F20261019')
        expect(url).toContain('location=hrad+Lipnice')
        expect(url).toContain('text=Camlann')
    })

    test('relative hints read as a calendar should', () => {
        const t = (key: string, options?: Record<string, unknown>) =>
            options?.count === undefined ? key : `${key}:${options.count}`

        expect(relativeHint(t, eventSpan(camlann)!, today)).toBe('Calendar.relative.inDays:13')
        expect(relativeHint(t, eventSpan(the3rd)!, new Date(2026, 9, 3))).toBe('Calendar.relative.now')
        expect(relativeHint(t, eventSpan(abroad)!, new Date(2026, 9, 16))).toBe('Calendar.relative.tomorrow')
    })

    test('the next event is the first one that has not finished yet', () => {
        expect(nextEventId([camlann, the3rd, the8th], today)).toBe('a')
        expect(nextEventId([the3rd], new Date(2026, 9, 30))).toBeUndefined()
        expect(nextEventId([camlann], new Date(2026, 9, 16))).toBe('c')
    })
})
