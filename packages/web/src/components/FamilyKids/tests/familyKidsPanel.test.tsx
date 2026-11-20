/**
 * FamilyKidsPanel: renders the family view sections from the mocked Apollo
 * client, toggles the filter chips into the catalog variables, and opens a
 * series drawer with its flat review list.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(
        fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)),
        'utf8',
    ),
)

type QueryAnswer = { data: Record<string, unknown> }

const queries: Record<string, () => Promise<QueryAnswer>> = {}
// .graphql imports are stubbed to {} in jest, so route by variables instead:
// FamilyGames carries `order`, FamilyEvents carries `kidsProgram`, TopFamilySeries
// carries `filter` without `order`, SeriesComments/FamilySeriesGames carry `seriesId`.
const route = (variables: Record<string, unknown> | undefined): string => {
    const v = variables ?? {}
    if ('seriesId' in v) return 'seriesId'
    if ('kidsProgram' in v) return 'FamilyEvents'
    if ('order' in v) return 'FamilyGames'
    if ('filter' in v) return 'TopFamilySeries'
    return 'unknown'
}
const clientMock = { query: jest.fn((options: { query: unknown; variables?: Record<string, unknown> }) => {
    const name = route(options.variables)
    const answer = queries[name]
    return answer ? answer() : Promise.resolve({ data: {} })
}) }

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => clientMock,
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: () => undefined, replace: () => undefined, pathname: '/rodiny', query: {} }),
}))
jest.unstable_mockModule('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}))
jest.unstable_mockModule('next/head', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game }: { game: { id: string; name: string } }) => <a href={`/hry/${game.id}`}>{game.name}</a>,
}))
jest.unstable_mockModule('../../common/UserLink/UserLink', () => ({
    default: ({ userId, children }: { userId: string; children?: React.ReactNode }) => <a href={`/uzivatel/${userId}`}>{children}</a>,
}))
jest.unstable_mockModule('../../common/GameRatingBox/GameRatingBox', () => ({
    GameRatingBox: () => <span data-testid="rating-box" />,
}))

const gamesData: QueryAnswer = {
    data: {
        games: {
            catalog: {
                totalAmount: 1,
                games: [
                    {
                        id: 'g1',
                        name: 'Rodinný larp',
                        year: 2026,
                        averageRating: 85,
                        amountOfRatings: 12,
                        description: '<p>Pro děti.</p>',
                        players: 12,
                        hours: 6,
                        days: null,
                        labels: [],
                        authors: [],
                        groups: [],
                        events: [],
                        coverImage: null,
                        web: null,
                        amountOfComments: 2,
                        series: { id: 's1', name: 'Florie' },
                    },
                ],
            },
        },
    },
}

const eventsData: QueryAnswer = {
    data: {
        eventCalendar: {
            totalAmount: 3,
            events: [
                {
                    id: 'e1',
                    name: 'Dětský tábor',
                    from: '2027-07-01',
                    to: '2027-07-07',
                    loc: 'Les',
                    web: null,
                    registrationUrl: 'https://reg.test',
                    registrationOpen: true,
                    registrationStatus: null,
                    registrationOpensAt: null,
                    amountOfPlayers: 20,
                    kidsProgram: true,
                    labels: [],
                    games: [
                        { id: 'g7', name: 'Hra akce', coverImage: { id: 'img1' } },
                    ],
                    coverImage: null,
                },
                {
                    id: 'e2',
                    name: 'Uzavřená akce',
                    from: '2027-08-01',
                    to: '2027-08-02',
                    loc: null,
                    web: null,
                    registrationUrl: null,
                    registrationOpen: false,
                    registrationStatus: 'CLOSED',
                    registrationOpensAt: null,
                    amountOfPlayers: null,
                    kidsProgram: true,
                    labels: [],
                    games: [],
                    coverImage: { id: 'img2' },
                },
                {
                    id: 'e3',
                    name: 'Akce bez přihlášky',
                    from: '2027-09-01',
                    to: '2027-09-02',
                    loc: null,
                    web: null,
                    registrationUrl: null,
                    registrationOpen: false,
                    registrationStatus: null,
                    registrationOpensAt: null,
                    amountOfPlayers: null,
                    kidsProgram: true,
                    labels: [],
                    games: [],
                    coverImage: null,
                },
            ],
        },
    },
}

const topSeriesData: QueryAnswer = {
    data: {
        games: {
            topFamilySeries: {
                totalAmount: 1,
                series: [
                    {
                        id: 's1',
                        name: 'Florie',
                        amountOfGames: 3,
                        amountOfRatings: 10,
                        averageRating: 86,
                        firstYear: 2000,
                        lastYear: 2026,
                        games: [],
                    },
                ],
            },
        },
    },
}

const seriesGamesData: QueryAnswer = {
    data: {
        seriesById: {
            id: 's1',
            name: 'Florie',
            amountOfGames: 1,
            amountOfRatings: 10,
            averageRating: 86,
            firstYear: 2026,
            lastYear: 2026,
            games: [
                {
                    id: 'g9',
                    name: 'Florie 2026',
                    year: 2026,
                    averageRating: 86,
                    amountOfRatings: 10,
                    labels: [],
                    authors: [],
                    groups: [],
                    events: [],
                    coverImage: null,
                    web: null,
                    amountOfComments: 1,
                    series: null,
                    description: null,
                    players: 20,
                    hours: null,
                    days: 3,
                },
            ],
        },
    },
}

const seriesCommentsData: QueryAnswer = {
    data: {
        seriesComments: {
            totalAmount: 1,
            comments: [
                {
                    id: 'c1',
                    comment: '<p>Skvělý dětský program</p>',
                    kidsReview: true,
                    added: '2026-08-01T10:00:00.000Z',
                    game: { id: 'g9', name: 'Florie 2026', year: 2026 },
                    user: { id: 'u1', name: ' Jana ', image: null },
                },
            ],
        },
    },
}

let FamilyKidsPanel: typeof import('../FamilyKidsPanel')['default']

beforeAll(async () => {
    FamilyKidsPanel = (await import('../FamilyKidsPanel')).default
})

beforeEach(() => {
    cleanup()
    clientMock.query.mockClear()
    queries['FamilyGames'] = () => Promise.resolve(gamesData)
    queries['FamilyEvents'] = () => Promise.resolve(eventsData)
    queries['TopFamilySeries'] = () => Promise.resolve(topSeriesData)
    let seriesCalls = 0
    queries['seriesId'] = () => {
        seriesCalls += 1
        // First seriesId call is FamilySeriesGames, the second is SeriesComments.
        return Promise.resolve(seriesCalls % 2 === 1 ? seriesGamesData : seriesCommentsData)
    }
})

describe('FamilyKidsPanel', () => {
    it('renders the family games, events and the TOP ladder from the API answers', async () => {
        render(<FamilyKidsPanel />)
        await new Promise((r) => setTimeout(r, 100))
        expect(await screen.findByText('Rodinný larp')).toBeTruthy()
        expect(screen.getByText('Dětský tábor')).toBeTruthy()
        expect(screen.getByText('Florie')).toBeTruthy()
        // The events query asked for kidsProgram events only.
        const eventsCall = clientMock.query.mock.calls.find(
            (c) => (c[0] as { variables?: Record<string, unknown> }).variables?.kidsProgram === true,
        )
        expect(eventsCall).toBeTruthy()
    })

    it('toggles the filter chips into the catalog variables', async () => {
        render(<FamilyKidsPanel />)
        await screen.findByText('Rodinný larp')
        clientMock.query.mockClear()

        fireEvent.click(screen.getByText('S hodnocením dětského programu'))
        await waitFor(() => expect(clientMock.query).toHaveBeenCalled())
        const vars = (clientMock.query.mock.calls.find(
            (c) => 'order' in ((c[0] as { variables?: Record<string, unknown> }).variables ?? {}),
        )![0] as unknown as { variables: { filter: Record<string, unknown> } }).variables.filter
        expect(vars.withKidsReviews).toBe(true)

        fireEvent.click(screen.getByText('Malá skupina (do 15 hráčů)'))
        fireEvent.click(screen.getByText('Jeden den'))
        await waitFor(() => {
            const calls = clientMock.query.mock.calls.filter(
                (c) => 'order' in ((c[0] as { variables?: Record<string, unknown> }).variables ?? {}),
            )
            const last = (calls[calls.length - 1][0] as unknown as { variables: { filter: Record<string, unknown> } }).variables.filter
            expect(last.playersTo).toBe(15)
            expect(last.durations).toEqual(['short', 'day'])
        })
    })

    it('a failed games query still settles the loading state', async () => {
        queries['FamilyGames'] = () => Promise.reject(new Error('boom'))
        render(<FamilyKidsPanel />)
        await waitFor(() => expect(screen.queryByText('Načítám…')).toBeNull())
    })

    it('opens a series drawer with the flat review list tagged by year and kids flag', async () => {
        render(<FamilyKidsPanel />)
        const top = await screen.findByText('Florie')
        fireEvent.click(top.parentElement?.parentElement ?? top) // .topName -> .topBody -> .topRow
        expect((await screen.findAllByText('Florie 2026')).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0)
        await waitFor(() => expect(screen.getByText('Skvělý dětský program', { exact: false })).toBeTruthy())
    })
})
