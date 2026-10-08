import { CalendarEventDataFragment } from '../../../graphql/__generated__/typescript-operations'
import { DEFAULT_CALENDAR_STATE, parseCalendarState, calendarStateToQuery } from '../calendarState'
import { filterCalendarEvents } from '../calendarUtils'

/**
 * The calendar's text filter. It was the missing half of "find an event": the
 * calendar could only be narrowed by date, length, place, status and labels, so
 * an event whose name the visitor half remembers had no way in. The filter runs
 * on the loaded window through the shared matching rule (diacritics, word
 * prefixes, any order).
 */

const at = (year: number, month: number, day: number) => String(Date.UTC(year, month - 1, day))

const event = (
    id: string,
    name: string,
    from: string,
    to: string,
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

// October 2026: 3rd and 10th are Saturdays.
const today = new Date(2026, 9, 2)
const requiem = event('a', 'Requiem za Bête', at(2026, 10, 3), at(2026, 10, 4), { loc: 'Brno' })
const soutez = event('b', 'Šermířská soutěž', at(2026, 10, 10), at(2026, 10, 11), { loc: 'Ostrava' })
const events = [requiem, soutez]

const filteredNames = (query?: string) =>
    filterCalendarEvents(events, { ...DEFAULT_CALENDAR_STATE, query }, today).map((item) => item.name)

describe('calendar text filter', () => {
    test('no query keeps everything', () => {
        expect(filteredNames()).toHaveLength(2)
    })

    test('matches the name without diacritics', () => {
        expect(filteredNames('bete')).toEqual(['Requiem za Bête'])
        expect(filteredNames('sermirska')).toEqual(['Šermířská soutěž'])
    })

    test('matches the place as well, so "what is in Brno" works', () => {
        expect(filteredNames('brno')).toEqual(['Requiem za Bête'])
        expect(filteredNames('ostrava')).toEqual(['Šermířská soutěž'])
    })

    test('matches words in any order and needs all of them', () => {
        expect(filteredNames('bete requiem')).toEqual(['Requiem za Bête'])
        expect(filteredNames('requiem ostrava')).toEqual([])
    })

    test('a one letter query is ignored like everywhere else', () => {
        expect(filteredNames('r')).toHaveLength(2)
    })

    test('the query stacks with the other filters', () => {
        const state = { ...DEFAULT_CALENDAR_STATE, query: 'sermirska', withWeb: true }
        expect(filterCalendarEvents(events, state, today)).toEqual([])
    })
})

describe('calendar state carries the query in the URL', () => {
    test('parses the query and puts it back', () => {
        const state = parseCalendarState({ q: ' requiem ' })

        expect(state.query).toBe('requiem')
        expect(calendarStateToQuery(state).q).toBe('requiem')
    })

    test('an empty query is not part of the URL', () => {
        expect(parseCalendarState({}).query).toBeUndefined()
        expect(calendarStateToQuery({ ...DEFAULT_CALENDAR_STATE, query: '   ' }).q).toBeUndefined()
    })
})
