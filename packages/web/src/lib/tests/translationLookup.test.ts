import { csPluralSuffix, getNested } from '../translationLookup'

/**
 * The rules the i18n shim applies before a key reaches a component. The wording
 * "Hrál jsem" depends on the gender of the person it is about, and a visitor
 * without a stated gender has to read the neutral "Hrál/a jsem" instead of a
 * key name.
 */

const data = {
    GameDetail: {
        iPlayed: 'Hrál/a jsem',
        iPlayed_male: 'Hrál jsem',
        iPlayed_female: 'Hrála jsem',
        wantToPlay: 'Chci hrát',
    },
    UserDetail: {
        player_0: 'Hráč/čka jednoho larpu',
        player_1: 'Hráč/čka {{count}} larpů',
        player_female_0: 'Hráčka jednoho larpu',
        player_female_1: 'Hráčka {{count}} larpů',
    },
}

describe('getNested', () => {
    test('without a context it answers the plain key', () => {
        expect(getNested(data, 'GameDetail.iPlayed')).toBe('Hrál/a jsem')
    })

    test('a context picks the gendered variant', () => {
        expect(getNested(data, 'GameDetail.iPlayed', { context: 'female' })).toBe('Hrála jsem')
        expect(getNested(data, 'GameDetail.iPlayed', { context: 'male' })).toBe('Hrál jsem')
    })

    test('an unstated gender keeps the neutral wording', () => {
        expect(getNested(data, 'GameDetail.iPlayed', { context: 'other' })).toBe('Hrál/a jsem')
        expect(getNested(data, 'GameDetail.iPlayed', { context: undefined })).toBe('Hrál/a jsem')
        expect(getNested(data, 'GameDetail.iPlayed', { context: '' })).toBe('Hrál/a jsem')
        expect(getNested(data, 'GameDetail.iPlayed', {})).toBe('Hrál/a jsem')
    })

    test('a key without gendered variants is served as it is', () => {
        expect(getNested(data, 'GameDetail.wantToPlay', { context: 'female' })).toBe('Chci hrát')
    })

    test('gender and plural combine: key_context_suffix wins over both', () => {
        expect(getNested(data, 'UserDetail.player', { count: 1, context: 'female' })).toBe('Hráčka jednoho larpu')
        expect(getNested(data, 'UserDetail.player', { count: 3, context: 'female' })).toBe('Hráčka {{count}} larpů')
    })

    test('a gendered plural that is missing falls back to the plain plural', () => {
        // This fixture has no `player_male_*`, only the neutral plurals.
        expect(getNested(data, 'UserDetail.player', { count: 3, context: 'male' })).toBe('Hráč/čka {{count}} larpů')
    })

    test('an unknown key is returned as it is, never as undefined', () => {
        expect(getNested(data, 'GameDetail.nope')).toBe('GameDetail.nope')
        expect(getNested(data, 'Nope.nope', { context: 'female', count: 2 })).toBe('Nope.nope')
    })
})

describe('csPluralSuffix', () => {
    test('follows the Czech plural rules', () => {
        expect(csPluralSuffix(1)).toBe('_0')
        expect(csPluralSuffix(2)).toBe('_1')
        expect(csPluralSuffix(4)).toBe('_1')
        expect(csPluralSuffix(5)).toBe('_2')
        expect(csPluralSuffix(0)).toBe('_2')
    })
})
