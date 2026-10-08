import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { GameCatalogOrder } from '../../../graphql/__generated__/typescript-operations'

/**
 * The games section of the search page gained the catalog's facets and rankings,
 * so the branches worth pinning are: is the filter one click away and does the
 * order say what it is, does the heading still count what the list shows, can a
 * facet be taken off the list again, and does a preset write the same filter the
 * /games page would write (the names of the facets become the ids in the URL).
 */
let queryOptions: { onCompleted?: (data: unknown) => void; variables?: Record<string, unknown> } = {}

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, params?: { count?: number }) => (params?.count != null ? `${key}:${params.count}` : key),
    }),
}))

jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: (_document: unknown, options: typeof queryOptions) => {
        queryOptions = options

        return { loading: false }
    },
}))

jest.unstable_mockModule('../SearchGameRow', () => ({
    default: ({ game }: { game: { id: string } }) => <div data-testid={`row-${game.id}`} />,
}))

const facets = {
    __typename: 'GameCatalogFacets' as const,
    yearMin: 1990,
    yearMax: 2026,
    labels: [
        { __typename: 'GameCatalogLabelFacet' as const, id: '1', name: 'komorní', count: 21, isRequired: true },
        { __typename: 'GameCatalogLabelFacet' as const, id: '7', name: 'dřevárna', count: 12, isRequired: false },
    ],
    durations: [{ __typename: 'GameCatalogCount' as const, key: 'weekend', count: 6 }],
}

const game = (id: string) => ({
    __typename: 'Game' as const,
    id,
    name: `hra ${id}`,
    year: 2014,
    amountOfComments: 0,
    amountOfRatings: 0,
    averageRating: 0,
    totalRating: 0,
    labels: [],
    authors: null,
    groupAuthor: null,
})

const pageData = (totalAmount: number, games: ReturnType<typeof game>[]) => ({
    games: { catalog: { __typename: 'GameCatalogPaged' as const, totalAmount, games, facets } },
})

let GamesSearchPanel: typeof import('../GamesSearchPanel').default
let searchGamesState: typeof import('../searchHelpers').searchGamesState

beforeAll(async () => {
    // The pager asks whether the viewport is wide (useMediaQuery), which jsdom
    // does not implement.
    window.matchMedia = ((query: string) => ({
        matches: true,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        onchange: null,
    })) as unknown as typeof window.matchMedia

    GamesSearchPanel = (await import('../GamesSearchPanel')).default
    searchGamesState = (await import('../searchHelpers')).searchGamesState
})

const onStateChange = jest.fn()
const onReset = jest.fn()

const renderPanel = async (state = searchGamesState({}), totalAmount = 9, games = [game('1'), game('2')]) => {
    const result = render(
        <GamesSearchPanel query="larp" state={state} onStateChange={onStateChange} onReset={onReset} />,
    )

    // The panel keeps the previous page while the next one loads; the mock answers
    // through the same callback Apollo would call.
    await waitFor(() => expect(queryOptions.onCompleted).toBeDefined())
    await act(async () => {
        queryOptions.onCompleted?.(pageData(totalAmount, games))
    })

    return result
}

beforeEach(() => {
    queryOptions = {}
    onStateChange.mockReset()
    onReset.mockReset()
})

describe('the games of the search page carry the catalog facets and rankings', () => {
    it('asks with the search text and the search default order', async () => {
        await renderPanel()

        expect(queryOptions.variables?.filter).toEqual({ query: 'larp' })
        expect(queryOptions.variables?.order).toBe(GameCatalogOrder.Relevance)
        expect(queryOptions.variables?.limit).toBe(searchGamesState({}).size)
    })

    it('says which ranking the list is in and keeps the facets one click away', async () => {
        await renderPanel()

        expect(screen.getByTestId('search.gamesOrder').textContent).toContain('Catalog.order.Relevance')
        expect(screen.queryByTestId('search.gamesFilterPanel')).toBeNull()

        fireEvent.click(screen.getByTestId('search.gamesFilterToggle'))

        expect(screen.getByTestId('search.gamesFilterPanel')).toBeDefined()
    })

    it('counts what the list shows, filtered or not', async () => {
        const { unmount } = await renderPanel()
        expect(screen.getByTestId('search.resultCount').textContent).toBe('Search.resultCountGames:9')
        unmount()

        await renderPanel({ ...searchGamesState({}), labels: ['1'] }, 4)
        expect(screen.getByTestId('search.resultCount').textContent).toBe('Search.resultCountGamesFiltered:4')
    })

    it('offers the presets with the facet names they stand for', async () => {
        await renderPanel()

        // `Komorní` is a label of the result; the preset writes its *id*.
        fireEvent.click(screen.getByTestId('search.gamesPreset.komorni'))

        expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ labels: ['1'] }))
    })

    it('spells out what narrows the list and takes it off again', async () => {
        await renderPanel({ ...searchGamesState({}), labels: ['7'] })

        fireEvent.click(screen.getByTestId('search.gamesActiveFilter.label:7'))
        expect(onStateChange).toHaveBeenCalledWith({ labels: [] })

        fireEvent.click(screen.getByTestId('catalog.reset'))
        expect(onReset).toHaveBeenCalled()
    })

    it('shows the rows and where in the result the visitor is', async () => {
        await renderPanel()

        expect(screen.getByTestId('search.section.games').children).toHaveLength(2)
        expect(screen.getByTestId('search.range').textContent).toBe('Search.rangeLabel')
    })

    it('an empty filter is not "nothing was found", it is a filter to undo', async () => {
        await renderPanel({ ...searchGamesState({}), labels: ['7'] }, 0)

        expect(screen.getByTestId('search.empty')).toBeDefined()
        expect(screen.queryByTestId('search.section.games')).toBeNull()
    })
})
