import {
    bestMatches,
    duplicateCount,
    eventDateLabel,
    eventTimeRange,
    gameMatchReason,
    labelsToShow,
    pageRange,
    personMatchReason,
    searchGamesState,
    searchPageQuery,
    searchQueryParams,
    searchTypeFromParam,
} from '../searchHelpers'
import { GameCatalogOrder } from '../../../graphql/__generated__/typescript-operations'

/**
 * The decisions the search page makes: what the URL says, which rows the "best
 * matches" block shows, why a row is in the list at all, what an event row's
 * date reads like and where in the result the pager is. The render test pins the
 * wiring; the branches live here.
 */

describe('the kind of result lives in the URL as typ=', () => {
    test('the Czech slug is what a link carries', () => {
        expect(searchTypeFromParam('hry')).toBe('games')
        expect(searchTypeFromParam('lide')).toBe('users')
        expect(searchTypeFromParam('udalosti')).toBe('events')
        expect(searchTypeFromParam('skupiny')).toBe('groups')
    })

    test('the English value of a hand-written link still resolves', () => {
        expect(searchTypeFromParam('users')).toBe('users')
    })

    test('anything else means all kinds', () => {
        expect(searchTypeFromParam('nesmysl')).toBeUndefined()
        expect(searchTypeFromParam(undefined)).toBeUndefined()
        expect(searchTypeFromParam(['udalosti', 'hry'])).toBe('events')
    })

    test('the query and the picked kind travel together', () => {
        expect(searchQueryParams('larp', 'events')).toEqual({ q: 'larp', typ: 'udalosti' })
        expect(searchQueryParams('  larp  ', undefined)).toEqual({ q: 'larp' })
        expect(searchQueryParams('', undefined)).toEqual({})
    })
})

describe('the best matches block', () => {
    test('takes up to three of every kind, interleaved by rank', () => {
        const perType = {
            games: ['g1', 'g2', 'g3', 'g4'],
            users: ['u1', 'u2'],
            events: ['e1', 'e2', 'e3'],
            groups: ['s1'],
        }

        expect(bestMatches(perType, 3)).toEqual([
            { type: 'games', item: 'g1' },
            { type: 'users', item: 'u1' },
            { type: 'events', item: 'e1' },
            { type: 'groups', item: 's1' },
            { type: 'games', item: 'g2' },
            { type: 'users', item: 'u2' },
            { type: 'events', item: 'e2' },
            { type: 'games', item: 'g3' },
            { type: 'events', item: 'e3' },
        ])
    })

    test('a kind with nothing found leaves no gap', () => {
        expect(bestMatches({ games: ['g1'], users: [], events: null }, 3)).toEqual([{ type: 'games', item: 'g1' }])
    })
})

describe('why a game is in the list', () => {
    const game = (patch: Record<string, unknown>) => ({
        id: '1',
        name: 'Pomezí',
        year: 2020,
        amountOfComments: 0,
        amountOfRatings: 0,
        averageRating: 0,
        totalRating: 0,
        labels: [],
        authors: null,
        groupAuthor: null,
        ...patch,
    })

    test('a game whose name matched needs no explanation', () => {
        expect(gameMatchReason(game({ name: 'Pomezí larp' }), 'larp')).toBeUndefined()
    })

    test('a game found through its author names the author', () => {
        // 37 of 37 games for `novak` carry no `novak` in the name.
        const reason = gameMatchReason(
            game({ name: 'Studna', authors: [{ id: '9', name: 'Jan Novák' }] }),
            'novak',
        )

        expect(reason).toEqual({ kind: 'author', name: 'Jan Novák' })
    })

    test('a game found through its group names the group', () => {
        const reason = gameMatchReason(
            game({ name: 'Ztraceni', groupAuthor: [{ id: '5', name: 'Moravian LARP' }] }),
            'larp',
        )

        expect(reason).toEqual({ kind: 'group', name: 'Moravian LARP' })
    })

    test('a match nobody can explain says nothing rather than guessing', () => {
        expect(gameMatchReason(game({}), 'novak')).toBeUndefined()
    })
})

describe('why a person is in the list', () => {
    const person = (patch: Record<string, unknown>) => ({
        id: '1',
        name: 'Jozef Novák',
        nickname: null,
        birthDate: null,
        city: null,
        image: null,
        ...patch,
    })

    test('the name is enough', () => {
        expect(personMatchReason(person({}), 'novak jozef')).toBeUndefined()
    })

    test('a nickname is spelled out — the row shows the name', () => {
        expect(personMatchReason(person({ name: 'Jozef N.', nickname: 'Jozka' }), 'jozka')).toEqual({
            kind: 'nickname',
            name: 'Jozka',
        })
    })

    test('a city is spelled out too', () => {
        expect(personMatchReason(person({ name: 'Jozef Novák', city: 'Brno' }), 'brno')).toEqual({
            kind: 'city',
            name: 'Brno',
        })
    })
})

describe('a game row keeps the label line short', () => {
    test('three labels and a count of the rest', () => {
        const labels = [
            { id: '1', name: 'fantasy' },
            { id: '2', name: 'svět' },
            { id: '3', name: 'dřevárna' },
            { id: '4', name: 'komorní' },
            { id: '5', name: 'pro začátečníky' },
        ]

        expect(labelsToShow(labels)).toEqual({ shown: ['fantasy', 'svět', 'dřevárna'], more: 2 })
    })

    test('a game with no label says so instead of leaving the line out', () => {
        expect(labelsToShow([])).toEqual({ shown: [], more: 0 })
        expect(labelsToShow(null)).toEqual({ shown: [], more: 0 })
    })
})

describe('an event row has to carry its date', () => {
    // The calendar card has no date on it (the day heading above it does) and a
    // search list has no day headings.
    test('one day', () => {
        expect(eventDateLabel('2026-10-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z')).toBe('17. 10. 2026')
    })

    test('a few days inside one month', () => {
        // The production shape: midnight in Prague stored as 22:00Z the day
        // before, which is what the calendar shows as well (jest pins
        // Europe/Prague in jest.globalSetup.cjs).
        expect(eventDateLabel('2021-06-24T22:00:00.000Z', '2021-06-26T22:00:00.000Z')).toBe('25.–27. 6. 2021')
    })

    test('across two months of one year', () => {
        expect(eventDateLabel('2022-04-30T00:00:00.000Z', '2022-05-02T00:00:00.000Z')).toBe('30. 4.–2. 5. 2022')
    })

    test('across two years spells both out', () => {
        expect(eventDateLabel('2022-12-31T00:00:00.000Z', '2023-01-02T00:00:00.000Z')).toBe(
            '31. 12. 2022–2. 1. 2023',
        )
    })

    test('an event without a start has no date to show', () => {
        expect(eventDateLabel(null, null)).toBe('')
    })
})

describe('an event row says how many identical rows it stands for', () => {
    const duplicates = [{ eventId: '100', count: 4 }]

    test('the cluster of the row', () => {
        expect(duplicateCount(duplicates, '100')).toBe(4)
    })

    test('a row of its own has none', () => {
        expect(duplicateCount(duplicates, '101')).toBe(0)
        expect(duplicateCount(null, '100')).toBe(0)
    })
})

describe('the events list can be narrowed in time', () => {
    const now = new Date('2026-10-08T12:00:00.000Z')

    test('everything asks for no window at all', () => {
        expect(eventTimeRange('all', now)).toEqual({})
    })

    test('upcoming starts today', () => {
        expect(eventTimeRange('upcoming', now)).toEqual({ from: '2026-10-08' })
    })

    test('the archive ends today', () => {
        expect(eventTimeRange('archive', now)).toEqual({ to: '2026-10-08' })
    })
})

describe('the pager can say where in the result the visitor is', () => {
    test('the first page of a long result', () => {
        expect(pageRange(121, 0, 25)).toEqual({ from: 1, to: 25 })
    })

    test('the last, short page', () => {
        expect(pageRange(121, 100, 25)).toEqual({ from: 101, to: 121 })
    })

    test('nothing found has no range', () => {
        expect(pageRange(0, 0, 25)).toBeUndefined()
    })
})

describe('the games carry the catalog facets, and the URL carries them too', () => {
    test('the games section starts at relevance, the catalog order comes only if asked for', () => {
        expect(searchGamesState({}).order).toBe(GameCatalogOrder.Relevance)
        expect(searchGamesState({ q: 'larp' }).order).toBe(GameCatalogOrder.Relevance)
        // An explicit order in the URL wins — including the catalog's own default.
        expect(searchGamesState({ order: 'Best' }).order).toBe(GameCatalogOrder.Best)
        expect(searchGamesState({ order: 'Recommended' }).order).toBe(GameCatalogOrder.Recommended)
        // An order the catalog does not know is not an order.
        expect(searchGamesState({ order: 'Nonsense' }).order).toBe(GameCatalogOrder.Relevance)
    })

    test('a filtered games list is a link: the facets ride in the URL next to q and typ', () => {
        const state = { ...searchGamesState({}), labels: ['12'], minRating: 80, order: GameCatalogOrder.Best }
        const params = searchPageQuery('larp', 'games', state)

        expect(params).toEqual({ q: 'larp', typ: 'hry', labels: '12', rating: '80', order: 'Best' })
    })

    test('the default relevance order does not clutter the common URL', () => {
        expect(searchPageQuery('larp', 'games', searchGamesState({}))).toEqual({ q: 'larp', typ: 'hry' })
    })

    test('the facets of the games never leak into another kind of result', () => {
        const state = { ...searchGamesState({}), labels: ['12'] }

        expect(searchPageQuery('larp', 'events', state)).toEqual({ q: 'larp', typ: 'udalosti' })
        expect(searchPageQuery('larp', undefined, state)).toEqual({ q: 'larp' })
    })
})
