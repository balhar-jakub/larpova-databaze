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
    toggleSource,
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

    test('the source parameter defaults to larp-only and parses a comma list sorted', () => {
        expect(parseCalendarState({}).sources).toEqual(['larp'])

        const both = parseCalendarState({ src: 'other,larp' })
        expect(both.sources).toEqual(['larp', 'other'])
        expect(hasCalendarFilters(both)).toBe(true)

        // Invalid values are dropped; an all-invalid list falls back to the default.
        expect(parseCalendarState({ src: 'nonsense' }).sources).toEqual(['larp'])
        expect(parseCalendarState({ src: 'other,bogus' }).sources).toEqual(['other'])
    })

    test('the source selection round-trips through the URL, the default is omitted', () => {
        const onlyOther = parseCalendarState({ src: 'other' })
        expect(calendarStateToQuery(onlyOther)).toEqual({ src: 'other' })
        expect(parseCalendarState(calendarStateToQuery(onlyOther))).toEqual(onlyOther)

        // Both sources selected serialises explicitly (it means "no split
        // filter"), the default ['larp'] does not.
        const both = parseCalendarState({ src: 'larp,other' })
        expect(calendarStateToQuery(both)).toEqual({ src: 'larp,other' })
        expect(parseCalendarState(calendarStateToQuery(both))).toEqual(both)
        expect(calendarStateToQuery(parseCalendarState({}))).toEqual({})
    })

    test('hasCalendarFilters notices a non-default source selection and reset restores it', () => {
        expect(hasCalendarFilters(parseCalendarState({ src: 'other' }))).toBe(true)
        expect(hasCalendarFilters(parseCalendarState({ src: 'larp,other' }))).toBe(true)
        expect(hasCalendarFilters(parseCalendarState({}))).toBe(false)

        const cleared = clearCalendarFilters(parseCalendarState({ src: 'other', reg: '1' }))
        expect(cleared.sources).toEqual(['larp'])
        expect(cleared.registrationOpen).toBe(false)
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

    test('toggleSource adds and removes a source, never emptying the list', () => {
        expect(toggleSource(base, 'other').sources).toEqual(['larp', 'other'])
        expect(toggleSource(toggleSource(base, 'other'), 'larp').sources).toEqual(['other'])
        // Unchecking the last source falls back to the default instead of
        // showing an empty calendar.
        expect(toggleSource(parseCalendarState({ src: 'other' }), 'other').sources).toEqual(['larp'])
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

    test('a non-default source gets a removable chip of kind "source"', () => {
        const state = parseCalendarState({ src: 'larp,other' })
        const filters = calendarActiveFilters(state, {})

        const sourceChip = filters.find((filter) => filter.kind === 'source')
        expect(sourceChip).toBeTruthy()
        expect(sourceChip?.value).toBe('other')

        // Clicking the chip removes only the non-default source.
        const withoutChip = { ...state, ...sourceChip!.remove }
        expect(withoutChip.sources).toEqual(['larp'])

        // The default state has no source chip at all.
        expect(calendarActiveFilters(parseCalendarState({}), {}).some((filter) => filter.kind === 'source')).toBe(false)
    })
})
