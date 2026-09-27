import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'

const queryMock = jest.fn()

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, params?: { count?: number; value?: number; name?: string }) =>
            params?.count != null ? `${key}:${params.count}` : key,
    }),
}))

jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({ query: queryMock }),
}))

const replaceMock = jest.fn()

// The panel adopts whatever the URL says, so the router mock has to answer with
// the same query the panel was rendered with.
let routerQuery: Record<string, string> = {}

jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ query: routerQuery, pathname: '/games', replace: replaceMock }),
}))

jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))

jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <a className={className} href="/larp/test">
            {children}
        </a>
    ),
}))

let CatalogPanel: typeof import('../CatalogPanel').default

beforeAll(async () => {
    CatalogPanel = (await import('../CatalogPanel')).default
})

const game = (id: string, name: string) => ({
    __typename: 'Game' as const,
    id,
    name,
    year: 2014,
    hours: null,
    days: 2,
    players: 40,
    amountOfComments: 3,
    amountOfRatings: 20,
    amountOfPlayed: 10,
    averageRating: 90,
    coverImage: null,
    labels: [{ __typename: 'Label' as const, id: '2', name: 'dramatický' }],
})

const facets = {
    __typename: 'GameCatalogFacets' as const,
    yearMin: 1990,
    yearMax: 2026,
    labels: [
        { __typename: 'GameCatalogLabelFacet' as const, id: '1', name: 'komorní', count: 21, isRequired: true },
        { __typename: 'GameCatalogLabelFacet' as const, id: '2', name: 'dramatický', count: 17, isRequired: true },
        { __typename: 'GameCatalogLabelFacet' as const, id: '7', name: 'dřevárna', count: 12, isRequired: false },
    ],
    durations: [
        { __typename: 'GameCatalogCount' as const, key: 'short', count: 4 },
        { __typename: 'GameCatalogCount' as const, key: 'day', count: 5 },
        { __typename: 'GameCatalogCount' as const, key: 'weekend', count: 6 },
        { __typename: 'GameCatalogCount' as const, key: 'long', count: 7 },
    ],
}

const page = (games: ReturnType<typeof game>[], totalAmount: number) => ({
    data: { games: { catalog: { __typename: 'GameCatalogPaged' as const, totalAmount, games, facets } } },
})

beforeEach(() => {
    queryMock.mockReset()
    replaceMock.mockReset()
    routerQuery = {}
})

/** Renders the panel the way /games does: the URL query is the initial state. */
const renderPanel = (query: Record<string, string> = {}) => {
    routerQuery = query
    return render(<CatalogPanel initialQuery={query} />)
}

describe('CatalogPanel', () => {
    it('renders the games the API returns', async () => {
        queryMock.mockResolvedValue(page([game('1', 'Legie'), game('2', 'Moon')], 2))

        renderPanel()

        expect(await screen.findByText('Legie')).toBeTruthy()
        expect(screen.getByText('Moon')).toBeTruthy()
        expect(screen.getByTestId('catalog.resultCount').textContent).toBe('Catalog.resultCount:2')
        // Everything fits on one page, so there is nothing more to load.
        expect(screen.queryByTestId('catalog.loadMore')).toBeNull()
    })

    it('asks for the recommended order by default and the page size from the state', async () => {
        queryMock.mockResolvedValue(page([game('1', 'Legie')], 1))

        renderPanel()

        await waitFor(() => expect(queryMock).toHaveBeenCalled())
        expect(queryMock.mock.calls[0][0].variables).toMatchObject({
            order: 'Recommended',
            offset: 0,
            limit: 24,
            filter: {},
        })
    })

    it('loads the next page on demand and appends it', async () => {
        queryMock
            .mockResolvedValueOnce(page([game('1', 'Legie')], 3))
            .mockResolvedValueOnce(page([game('2', 'Moon')], 3))

        renderPanel()

        const loadMore = await screen.findByTestId('catalog.loadMore')
        fireEvent.click(loadMore)

        expect(await screen.findByText('Moon')).toBeTruthy()
        expect(screen.getByText('Legie')).toBeTruthy()
        expect(queryMock.mock.calls[1][0].variables.offset).toBe(1)
    })

    it('turns a label filter into a query, a URL and a chip', async () => {
        queryMock.mockResolvedValue(page([game('1', 'Legie')], 1))

        renderPanel()
        await screen.findByText('Legie')

        fireEvent.click(screen.getByRole('checkbox', { name: /komorní/ }))

        await waitFor(() => expect(replaceMock).toHaveBeenCalled())
        expect(replaceMock.mock.calls[0][0].query).toEqual({ labels: '1' })

        await waitFor(() =>
            expect(queryMock.mock.calls[1][0].variables.filter).toEqual({ allLabels: ['1'] }),
        )
        // The active filter is visible and can be removed again.
        expect(screen.getByText(/Catalog\.active\.label/)).toBeTruthy()
        expect(screen.getByText('komorní')).toBeTruthy()
    })

    it('switches to "any label" mode', async () => {
        queryMock.mockResolvedValue(page([game('1', 'Legie')], 1))

        renderPanel({ labels: '1,2' })
        await screen.findByText('Legie')

        fireEvent.click(screen.getByText('Catalog.filters.labelModeAny'))

        await waitFor(() =>
            expect(queryMock.mock.calls[1][0].variables.filter).toEqual({ anyLabels: ['1', '2'] }),
        )
        expect(replaceMock.mock.calls[0][0].query).toMatchObject({ labels: '1,2', mode: 'any' })
    })

    it('applies a preset', async () => {
        queryMock.mockResolvedValue(page([game('1', 'Legie')], 1))

        renderPanel()
        await screen.findByText('Legie')

        fireEvent.click(screen.getByText('Catalog.presets.novinky'))

        await waitFor(() => expect(replaceMock).toHaveBeenCalled())
        expect(replaceMock.mock.calls[0][0].query).toEqual({ order: 'Newest', days: '365' })
    })

    it('hides a preset whose label the database does not have', async () => {
        // The facets list what the database actually contains — a preset for a
        // label nobody uses must not show up.
        queryMock.mockResolvedValue({
            data: {
                games: {
                    catalog: {
                        __typename: 'GameCatalogPaged',
                        totalAmount: 1,
                        games: [game('1', 'Legie')],
                        facets: { ...facets, labels: facets.labels.filter((l) => l.name !== 'dřevárna') },
                    },
                },
            },
        })

        renderPanel()
        await screen.findByText('Legie')

        expect(screen.getByText('Catalog.presets.komorni')).toBeTruthy()
        expect(screen.queryByText('Catalog.presets.drevarny')).toBeNull()
    })

    it('clears every filter at once', async () => {
        queryMock.mockResolvedValue(page([game('1', 'Legie')], 1))

        renderPanel({ labels: '1', rating: '80', dur: 'short' })
        await screen.findByText('Legie')

        fireEvent.click(screen.getByTestId('catalog.reset'))

        await waitFor(() => expect(replaceMock).toHaveBeenCalled())
        expect(replaceMock.mock.calls[0][0].query).toEqual({})
        await waitFor(() => expect(queryMock.mock.calls[1][0].variables.filter).toEqual({}))
    })

    it('says so when nothing matches', async () => {
        queryMock.mockResolvedValue(page([], 0))

        renderPanel({ labels: '1' })

        expect(await screen.findByTestId('catalog.empty')).toBeTruthy()
    })
})
