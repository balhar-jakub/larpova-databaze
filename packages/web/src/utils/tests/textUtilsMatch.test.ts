import {
    MIN_MATCH_QUERY_LENGTH,
    foldForMatch,
    highlightSegments,
    matchTextQuery,
    tokenizeMatchQuery,
} from '../textUtils'

/**
 * The client side of the search rule (see foldSearchText / matchCandidate in
 * packages/api/src/resolvers/search.ts). The results are selected by the API, so
 * the client only has to agree with it — about the diacritics, the word starts
 * and the highlight positions.
 */
describe('foldForMatch', () => {
    test('strips Czech diacritics and lower cases', () => {
        expect(foldForMatch('Novák')).toBe('novak')
        expect(foldForMatch('ŠŤASTNÝ ŘEZNÍK')).toBe('stastny reznik')
        expect(foldForMatch('De la Bête')).toBe('de la bete')
    })

    test('never changes the number of characters, or the highlight would slip', () => {
        const values = ['Novák', 'Řehoř', 'Čapek Ů', 'ďťňěščžýáíé']

        values.forEach((value) => {
            expect(foldForMatch(value)).toHaveLength(Array.from(value).length)
        })
    })
})

describe('tokenizeMatchQuery', () => {
    test('drops a query too short to search, like the API does', () => {
        expect(tokenizeMatchQuery('a')).toEqual([])
        expect(tokenizeMatchQuery(' ')).toEqual([])
        expect(tokenizeMatchQuery(null)).toEqual([])
        expect(MIN_MATCH_QUERY_LENGTH).toBe(2)
    })

    test('splits on punctuation and drops duplicates', () => {
        expect(tokenizeMatchQuery('Novák, Jozef')).toEqual(['novak', 'jozef'])
        expect(tokenizeMatchQuery('novak, NOVÁK')).toEqual(['novak'])
    })
})

describe('matchTextQuery', () => {
    test('ignores diacritics and the case on both sides', () => {
        expect(matchTextQuery('Novák', 'novak')).toBe(true)
        expect(matchTextQuery('novak', 'Novák')).toBe(true)
        expect(matchTextQuery('Bête Noire', 'bete')).toBe(true)
    })

    test('does not care about the word order, but every word has to be there', () => {
        expect(matchTextQuery('Jozef Novák', 'novak jozef')).toBe(true)
        expect(matchTextQuery('Jozef Novák', 'novak')).toBe(true)
        expect(matchTextQuery('Jozef Novák', 'novak petr')).toBe(false)
    })

    test('matches anywhere in a list of fields', () => {
        expect(matchTextQuery(['Národ Sobě', 'Praha'], 'praha')).toBe(true)
        expect(matchTextQuery([null, 'Brno'], 'brno')).toBe(true)
        expect(matchTextQuery([null, undefined], 'brno')).toBe(false)
    })

    test('a query too short to search filters nothing out', () => {
        expect(matchTextQuery('Novák', 'a')).toBe(true)
        expect(matchTextQuery('Novák', '')).toBe(true)
    })
})

describe('highlightSegments', () => {
    const matched = (text: string, query: string) =>
        highlightSegments(text, query)
            .filter((segment) => segment.matched)
            .map((segment) => segment.value)

    test('lights the words the query hit, diacritics included', () => {
        expect(matched('Jozef Novák', 'novak')).toEqual(['Novák'])
        expect(matched('Nováková', 'novak')).toEqual(['Novák'])
        expect(matched('De la Bête', 'bete')).toEqual(['Bête'])
    })

    test('lights every word of a multi-word query, in any order', () => {
        expect(matched('Jozef Novák', 'novak jozef')).toEqual(['Jozef', 'Novák'])
        expect(matched('De la Bête', 'd l b')).toEqual(['D', 'l', 'B'])
    })

    test('the segments rebuild the original text exactly', () => {
        const segments = highlightSegments('Novák & synové', 'novak synove')

        expect(segments.map((segment) => segment.value).join('')).toBe('Novák & synové')
    })

    test('a query too short to search lights nothing', () => {
        expect(matched('Novák', 'n')).toEqual([])
        expect(highlightSegments('Novák', 'a')[0]).toEqual({ value: 'Novák', matched: false })
    })
})
