import { GameCatalogOrder } from '../../../graphql/__generated__/typescript-operations'
import {
    CATALOG_PRESETS,
    DEFAULT_CATALOG_SIZE,
    catalogActiveFilters,
    catalogStateKey,
    catalogStateToFilter,
    catalogStateToQuery,
    clearCatalogFilters,
    hasCatalogFilters,
    isPresetActive,
    parseCatalogState,
    presetPatch,
    toggleDuration,
    toggleLabel,
    togglePreset,
} from '../catalogState'

const preset = (key: string) => CATALOG_PRESETS.find((item) => item.key === key)!
const labelIdsByName = { 'komorní': '1', 'dřevárna': '7' }

describe('parseCatalogState', () => {
    test('an empty query string is the default state', () => {
        const state = parseCatalogState({})

        expect(state.order).toBe(GameCatalogOrder.Recommended)
        expect(state.size).toBe(DEFAULT_CATALOG_SIZE)
        expect(state.labels).toEqual([])
        expect(state.durations).toEqual([])
        expect(state.labelMode).toBe('all')
        expect(hasCatalogFilters(state)).toBe(false)
    })

    test('old ladderType links keep working', () => {
        expect(parseCatalogState({ ladderType: 'Best' }).order).toBe(GameCatalogOrder.Best)
        expect(parseCatalogState({ ladderType: 'Recent' }).order).toBe(GameCatalogOrder.Newest)
        expect(parseCatalogState({ ladderType: 'MostPlayed' }).order).toBe(GameCatalogOrder.MostPlayed)
        expect(parseCatalogState({ ladderType: 'RecentAndMostPlayed' }).order).toBe(
            GameCatalogOrder.Recommended,
        )
    })

    test('order in the URL wins over the legacy parameter', () => {
        expect(parseCatalogState({ order: 'NameAsc', ladderType: 'Best' }).order).toBe(
            GameCatalogOrder.NameAsc,
        )
    })

    test('an unknown order falls back to the default', () => {
        expect(parseCatalogState({ order: 'Nonsense' }).order).toBe(GameCatalogOrder.Recommended)
    })

    test('lists are split, trimmed and sorted', () => {
        const state = parseCatalogState({ labels: ' 5 ,1,,3 ', dur: 'long,short' })

        expect(state.labels).toEqual(['1', '3', '5'])
        expect(state.durations).toEqual(['long', 'short'])
    })

    test('duration keys the API does not know are dropped', () => {
        expect(parseCatalogState({ dur: 'short,forever' }).durations).toEqual(['short'])
    })

    test('numbers and flags are parsed, empty values are not numbers', () => {
        const state = parseCatalogState({
            yf: '2010',
            yt: '2020',
            pf: '20',
            rating: '80',
            minr: '5',
            comments: '1',
            img: '1',
            days: '365',
        })

        expect(state.yearFrom).toBe(2010)
        expect(state.yearTo).toBe(2020)
        expect(state.playersFrom).toBe(20)
        expect(state.minRating).toBe(80)
        expect(state.minRatings).toBe(5)
        expect(state.withComments).toBe(true)
        expect(state.withImage).toBe(true)
        expect(state.addedWithinDays).toBe(365)
        expect(parseCatalogState({ yf: '' }).yearFrom).toBeUndefined()
        expect(parseCatalogState({ yf: 'abc' }).yearFrom).toBeUndefined()
    })

    test('the first value wins for repeated parameters', () => {
        expect(parseCatalogState({ order: ['Best', 'Newest'] }).order).toBe(GameCatalogOrder.Best)
    })
})

describe('catalogStateToQuery', () => {
    test('defaults are left out so a shared link stays short', () => {
        expect(catalogStateToQuery(parseCatalogState({}))).toEqual({})
    })

    test('a full state survives a round trip', () => {
        const state = parseCatalogState({
            order: 'Best',
            size: '48',
            mode: 'any',
            labels: '5,1',
            dur: 'short',
            yf: '2005',
            yt: '2015',
            pf: '10',
            pt: '80',
            rating: '80',
            minr: '5',
            comments: '1',
            img: '1',
            days: '365',
            q: 'legie',
        })

        const roundTripped = parseCatalogState(catalogStateToQuery(state))

        expect(roundTripped).toEqual(state)
        expect(catalogStateKey(roundTripped)).toBe(catalogStateKey(state))
    })

    test('a different state produces a different key', () => {
        const base = parseCatalogState({})
        expect(catalogStateKey({ ...base, labels: ['1'] })).not.toBe(catalogStateKey(base))
    })
})

describe('catalogStateToFilter', () => {
    test('selected labels are required by default and optional in "any" mode', () => {
        const state = parseCatalogState({ labels: '1,5' })

        expect(catalogStateToFilter(state).allLabels).toEqual(['1', '5'])
        expect(catalogStateToFilter({ ...state, labelMode: 'any' }).anyLabels).toEqual(['1', '5'])
        expect(catalogStateToFilter({ ...state, labelMode: 'any' }).allLabels).toBeUndefined()
    })

    test('an empty state sends an empty filter', () => {
        expect(catalogStateToFilter(parseCatalogState({}))).toEqual({})
    })

    test('flags become explicit booleans', () => {
        const filter = catalogStateToFilter(parseCatalogState({ comments: '1', img: '1' }))

        expect(filter.withComments).toBe(true)
        expect(filter.withImage).toBe(true)
    })
})

describe('changing the state', () => {
    test('toggling a label adds and removes it', () => {
        const base = parseCatalogState({})
        const withLabel = toggleLabel(base, '3')

        expect(withLabel.labels).toEqual(['3'])
        expect(toggleLabel(withLabel, '3').labels).toEqual([])
    })

    test('toggling a duration bucket works the same way', () => {
        const withBucket = toggleDuration(parseCatalogState({}), 'weekend')

        expect(withBucket.durations).toEqual(['weekend'])
        expect(toggleDuration(withBucket, 'weekend').durations).toEqual([])
    })

    test('clearing filters keeps the order, the size and the search term', () => {
        const state = parseCatalogState({
            order: 'Best',
            size: '48',
            labels: '1',
            dur: 'short',
            rating: '80',
            q: 'legie',
        })
        const cleared = clearCatalogFilters(state)

        expect(cleared.order).toBe(GameCatalogOrder.Best)
        expect(cleared.size).toBe(48)
        expect(cleared.query).toBe('legie')
        expect(hasCatalogFilters(cleared)).toBe(true) // the search term is still a filter
        expect(cleared.labels).toEqual([])
        expect(cleared.minRating).toBeUndefined()
    })
})

describe('active filters', () => {
    test('every filter produces a removable chip', () => {
        const state = parseCatalogState({
            labels: '1',
            dur: 'short',
            yf: '2010',
            pf: '20',
            rating: '80',
            minr: '5',
            comments: '1',
            img: '1',
            days: '365',
            q: 'legie',
        })
        const filters = catalogActiveFilters(state, { '1': 'komorní' })

        expect(filters.map((filter) => filter.kind)).toEqual([
            'label',
            'duration',
            'year',
            'players',
            'rating',
            'minRatings',
            'withComments',
            'withImage',
            'added',
            'query',
        ])
        expect(filters[0].value).toBe('komorní')

        // Removing the label chip keeps every other filter.
        const withoutLabel = { ...state, ...filters[0].remove }
        expect(withoutLabel.labels).toEqual([])
        expect(withoutLabel.minRating).toBe(80)
    })

    test('a label without a known name falls back to its id', () => {
        const filters = catalogActiveFilters(parseCatalogState({ labels: '42' }), {})

        expect(filters[0].value).toBe('42')
    })
})

describe('presets', () => {
    test('a label preset resolves the label id from the facets', () => {
        const patch = presetPatch(preset('komorni'), labelIdsByName)

        expect(patch?.labels).toEqual(['1'])
    })

    test('a preset whose label is missing is not offered', () => {
        expect(presetPatch(preset('komorni'), {})).toBeUndefined()
        expect(isPresetActive(preset('komorni'), parseCatalogState({}), {})).toBe(false)
        expect(togglePreset(preset('komorni'), parseCatalogState({}), {})).toEqual(parseCatalogState({}))
    })

    test('toggling a preset on and off returns to the original state', () => {
        const base = parseCatalogState({})
        const on = togglePreset(preset('novinky'), base, labelIdsByName)

        expect(on.order).toBe(GameCatalogOrder.Newest)
        expect(on.addedWithinDays).toBe(365)
        expect(isPresetActive(preset('novinky'), on, labelIdsByName)).toBe(true)

        const off = togglePreset(preset('novinky'), on, labelIdsByName)

        expect(off.order).toBe(GameCatalogOrder.Recommended)
        expect(off.addedWithinDays).toBeUndefined()
        expect(catalogStateKey(off)).toBe(catalogStateKey(base))
    })

    test('the recommended preset asks for recommended games with enough ratings', () => {
        const on = togglePreset(preset('doporucovane'), parseCatalogState({}), labelIdsByName)

        expect(on.minRating).toBe(80)
        expect(on.minRatings).toBe(5)
    })

    test('a preset does not wipe unrelated filters', () => {
        const state = parseCatalogState({ labels: '5', yf: '2010' })
        const on = togglePreset(preset('kratke'), state, labelIdsByName)

        expect(on.labels).toEqual(['5'])
        expect(on.yearFrom).toBe(2010)
        expect(on.durations).toEqual(['short'])
    })
})
