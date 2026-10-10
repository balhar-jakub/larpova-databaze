import {
    calendarActiveFilters,
    calendarStateKey,
    calendarStateToQuery,
    clearCalendarFilters,
    hasCalendarFilters,
    parseCalendarState,
    toggleDuration,
    toggleLabel,
    togglePlace,
} from '../calendarState'

describe('parseCalendarState', () => {
    test('an empty query string is the default state', () => {
        const state = parseCalendarState({})

        expect(state.view).toBe('vikendy')
        expect(state.when).toBe('all')
        expect(state.durations).toEqual([])
        expect(state.places).toEqual([])
        expect(state.withWeb).toBe(false)
        expect(state.registrationOpen).toBe(false)
        expect(state.labels).toEqual([])
        expect(state.year).toBeUndefined()
        expect(hasCalendarFilters(state)).toBe(false)
    })

    test('the open-registration parameter selects the open-registration filter', () => {
        const state = parseCalendarState({ reg: '1' })

        expect(state.registrationOpen).toBe(true)
        expect(hasCalendarFilters(state)).toBe(true)

        // Round trip: the filter survives its own URL.
        const query = calendarStateToQuery(state)
        expect(query).toEqual({ reg: '1' })
        expect(parseCalendarState(query)).toEqual(state)
    })

    test('legacy label parameters of the old page still select labels', () => {
        const required = parseCalendarState({ initialRequiredLabelIds: '3,7' })

        expect(required.labels).toEqual(['3', '7'])
        expect(required.labelMode).toBe('all')

        const optional = parseCalendarState({ initialOptionalLabelIds: '5' })

        expect(optional.labels).toEqual(['5'])
        expect(optional.labelMode).toBe('any')
    })

    test('the current parameters win over the legacy ones', () => {
        const state = parseCalendarState({ initialRequiredLabelIds: '3', lb: '9', lm: 'any' })

        expect(state.labels).toEqual(['9'])
        expect(state.labelMode).toBe('any')
    })

    test('unknown values fall back to the default instead of breaking the page', () => {
        const state = parseCalendarState({ v: 'nonsense', kdy: 'tomorrow', dd: 'weekend,nonsense', m: '2026-13' })

        expect(state.view).toBe('vikendy')
        expect(state.when).toBe('all')
        expect(state.durations).toEqual(['weekend'])
        expect(state.month).toBeUndefined()
    })

    test('lists are split, trimmed and sorted', () => {
        const state = parseCalendarState({ dd: ' long ,one,,', dk: 'noloc,cz' })

        expect(state.durations).toEqual(['long', 'one'])
        expect(state.places).toEqual(['cz', 'noloc'])
    })

    test('the view, the month and the history year survive the round trip', () => {
        const state = parseCalendarState({ v: 'historie', r: '2022', m: '2027-02' })

        expect(state.view).toBe('historie')
        expect(state.year).toBe(2022)
        expect(state.month).toBe('2027-02')
        expect(parseCalendarState(calendarStateToQuery(state))).toEqual(state)
    })
})

describe('changing the state', () => {
    const base = parseCalendarState({})

    test('toggles add and remove a value', () => {
        const withWeekend = toggleDuration(base, 'weekend')

        expect(withWeekend.durations).toEqual(['weekend'])
        expect(toggleDuration(withWeekend, 'weekend').durations).toEqual([])
        expect(togglePlace(base, 'foreign').places).toEqual(['foreign'])
        expect(toggleLabel(base, '4').labels).toEqual(['4'])
    })

    test('clearing the filters keeps the view and the selected year', () => {
        const state = parseCalendarState({ v: 'historie', r: '2019', kdy: 'weekend', dk: 'cz', reg: '1' })
        const cleared = clearCalendarFilters(state)

        expect(cleared.view).toBe('historie')
        expect(cleared.year).toBe(2019)
        expect(cleared.when).toBe('all')
        expect(cleared.places).toEqual([])
        expect(cleared.registrationOpen).toBe(false)
        expect(hasCalendarFilters(cleared)).toBe(false)
    })

    test('the same state always produces the same URL', () => {
        const state = parseCalendarState({ dd: 'one,long', dk: 'cz', web: '1' })
        const query = calendarStateToQuery(state)

        expect(query).toEqual({ dd: 'long,one', dk: 'cz', web: '1' })
        expect(calendarStateKey(parseCalendarState(query))).toBe(calendarStateKey(state))
    })

    test('active filters describe every filter and know how to remove it', () => {
        const state = parseCalendarState({ kdy: 'weekend', dd: 'one', dk: 'noloc', web: '1', reg: '1', lb: '2' })
        const filters = calendarActiveFilters(state, { '2': 'komorní' })

        expect(filters.map((filter) => filter.kind)).toEqual(['when', 'duration', 'place', 'withWeb', 'registrationOpen', 'label'])
        expect(filters.find((filter) => filter.kind === 'label')?.value).toBe('komorní')

        const withoutDurations = { ...state, ...filters.find((filter) => filter.kind === 'duration')!.remove }
        expect(withoutDurations.durations).toEqual([])

        const withoutRegistration = { ...state, ...filters.find((filter) => filter.kind === 'registrationOpen')!.remove }
        expect(withoutRegistration.registrationOpen).toBe(false)
    })
})
