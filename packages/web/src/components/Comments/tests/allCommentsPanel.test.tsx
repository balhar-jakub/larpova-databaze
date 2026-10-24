/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The all-comments listing: the page the homepage's „všechny komentáře“ link
 * opens. Pins that the page renders the comment rows the API answers with,
 * that the pager drives the query's offset, and that an empty database gets a
 * sentence instead of an empty panel.
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

let queryResult: Record<string, unknown> = {}
let queryVariables: Record<string, unknown> = {}

// The router the panel filters through — a minimal stand-in for next/router
// whose `query` the tests steer (the URL is the filter's source of truth).
let routerQuery: Record<string, string | string[]> = {}
const pushedQueries: Record<string, unknown>[] = []
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({
        query: routerQuery,
        push: (route: Record<string, unknown>) => {
            pushedQueries.push(route)
            routerQuery = { ...(route.query as Record<string, string | string[]>) }
            return Promise.resolve(true)
        },
    }),
}))

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options), locale: 'cs', ready: true }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: (_document: unknown, options: { variables: Record<string, unknown> }) => {
        queryVariables = options.variables
        return queryResult
    },
    useApolloClient: () => ({ mutate: () => Promise.resolve() }),
}))
jest.unstable_mockModule('next/head', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/GameCommentPanel/GameCommentPanel', () => ({
    default: ({ comment }: { comment: { commentAsText?: string | null } }) => (
        <div>{comment.commentAsText}</div>
    ),
}))
// The real panel is untestable under ESM jest (it loads its document through
// `require`), so it is replaced by the same contract: the rows, then the pager.
jest.unstable_mockModule('../../common/PagedCommentsPanel/PagedCommentsPanel', () => ({
    default: ({ page, offset, onOffsetChanged }: {
        page: { totalAmount: number; comments: { id: string; commentAsText?: string | null }[] },
        offset: number,
        onOffsetChanged: (n: number) => void,
    }) => (
        <div>
            {page.comments.map((comment) => (
                <div key={comment.id}>{comment.commentAsText}</div>
            ))}
            {page.totalAmount > 10 && (
                <button type="button" onClick={() => onOffsetChanged(offset + 10)}>next</button>
            )}
        </div>
    ),
}))

let Panel: typeof import('../AllCommentsPanel').AllCommentsPanel

beforeAll(async () => {
    Panel = (await import('../AllCommentsPanel')).AllCommentsPanel
})

const commentRow = (id: string, text: string) => ({
    id,
    commentAsText: text,
    added: '2026-10-01T10:00:00.000Z',
    amountOfUpvotes: 0,
    comment: '<p>html</p>',
    isHidden: false,
    user: { id: '1', name: 'Autor', nickname: 'Autor', image: null },
    game: { id: '5', name: 'Hra', averageRating: 80, amountOfRatings: 3 },
})

const statsResult = {
    lengths: { SHORT: 495, MEDIUM: 2976, LONG: 1336 },
    years: [
        { year: 2026, amount: 53 },
        { year: 2025, amount: 83 },
    ],
}

const withStats = (data: Record<string, unknown>) => ({ ...data, commentsStats: statsResult })

test('renders the newest comments with the pager', () => {
    queryResult = {
        loading: false,
        data: withStats({
            allComments: {
                totalAmount: 25,
                comments: [commentRow('1', 'Nejnovější komentář'), commentRow('2', 'Starší komentář')],
            },
        }),
    }
    routerQuery = {}

    render(<Panel />)

    expect(screen.getByText('Všechny komentáře')).toBeTruthy()
    expect(screen.getByText('Nejnovější komentář')).toBeTruthy()
    expect(screen.getByText('Starší komentář')).toBeTruthy()
    // 25 comments means there is a second page — the pager offers it.
    expect(screen.getByText('next')).toBeTruthy()
})

test('a pager click asks the server for the next page', () => {
    queryResult = {
        loading: false,
        data: withStats({
            allComments: { totalAmount: 25, comments: [commentRow('1', 'První stránka')] },
        }),
    }
    routerQuery = {}

    render(<Panel />)
    expect(queryVariables).toEqual({ offset: 0, limit: 10, length: undefined, year: undefined })

    fireEvent.click(screen.getByText('next'))
    expect(queryVariables).toEqual({ offset: 10, limit: 10, length: undefined, year: undefined })
})

test('an empty database gets a sentence, not an empty panel', () => {
    queryResult = {
        loading: false,
        data: withStats({ allComments: { totalAmount: 0, comments: [] } }),
    }
    routerQuery = {}

    render(<Panel />)

    expect(screen.getByText('Žádný komentář neodpovídá této kombinaci filtrů.')).toBeTruthy()
})

test('the toolbar renders the length and year chips with their stats numbers', () => {
    queryResult = {
        loading: false,
        data: withStats({
            allComments: { totalAmount: 25, comments: [commentRow('1', 'Komentář')] },
        }),
    }
    routerQuery = {}

    render(<Panel />)

    // The chips quote the stats the API answered with — the numbers a filter
    // click then has to actually list.
    expect(screen.getByText('Krátké (495)')).toBeTruthy()
    expect(screen.getByText('Střední (2976)')).toBeTruthy()
    expect(screen.getByText('Dlouhé (1336)')).toBeTruthy()
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText('2025')).toBeTruthy()
})

test('clicking the active length chip clears the filter from the URL', () => {
    queryResult = {
        loading: false,
        data: withStats({
            allComments: { totalAmount: 10, comments: [commentRow('1', 'Dlouhá recenze')] },
        }),
    }
    routerQuery = { delka: 'long' }
    pushedQueries.length = 0
    render(<Panel />)

    // The active chip clears the filter again.
    fireEvent.click(screen.getByText('Dlouhé (1336)'))
    expect(pushedQueries.length).toBe(1)
    expect(pushedQueries[0].query).not.toHaveProperty('delka')

    // And the "Všechny" chip does the same in one click.
    pushedQueries.length = 0
    fireEvent.click(screen.getAllByText('Všechny')[0])
    expect(pushedQueries[0].query).not.toHaveProperty('delka')
})

test('the year filter clears through its chip', () => {
    queryResult = {
        loading: false,
        data: withStats({
            allComments: { totalAmount: 10, comments: [commentRow('1', 'Recenze 2025')] },
            commentsStats: {
                commentsTotal: 10,
                byLength: [],
                byYear: [
                    { year: 2025, amountOfComments: 10 },
                    { year: 2024, amountOfComments: 5 },
                ],
            },
        }),
    }
    routerQuery = { rok: '2025' }
    pushedQueries.length = 0
    render(<Panel />)

    fireEvent.click(screen.getByText('2025'))
    expect(pushedQueries.length).toBe(1)
    expect(pushedQueries[0].query).not.toHaveProperty('rok')
})

test('a length chip click filters the query and lands in the URL', () => {
    queryResult = {
        loading: false,
        data: withStats({
            allComments: { totalAmount: 1336, comments: [commentRow('1', 'Dlouhá recenze')] },
        }),
    }
    routerQuery = {}
    pushedQueries.length = 0

    render(<Panel />)

    fireEvent.click(screen.getByText('Dlouhé (1336)'))

    // The URL is the source of truth: the filter landed in `delka`.
    expect(pushedQueries.length).toBe(1)
    expect(pushedQueries[0].query).toEqual(expect.objectContaining({ delka: 'long' }))
    expect(routerQuery).toEqual({ delka: 'long' })
})

test('a year chip click filters by the year and composes with the length', () => {
    queryResult = {
        loading: false,
        data: withStats({
            allComments: { totalAmount: 53, comments: [commentRow('1', 'Letošek')] },
        }),
    }
    // The URL arrived pre-filtered by length — a filtered list is a link.
    routerQuery = { delka: 'long' }

    render(<Panel />)
    expect(queryVariables).toEqual({ offset: 0, limit: 10, length: 'LONG', year: undefined })

    fireEvent.click(screen.getByText('2025'))

    expect(routerQuery).toEqual({ delka: 'long', rok: '2025' })
})

test('branch arms: loading without a page, missing stats, array URL params', () => {
    // Loading with no page yet: the big loading state, not the empty sentence.
    queryResult = { loading: true, data: undefined }
    routerQuery = {}
    const { unmount } = render(<Panel />)
    expect(screen.queryByText('Žádný komentář neodpovídá této kombinaci filtrů.')).toBeNull()
    unmount()

    // No stats at all: the chips fall back to zeros (stats?.lengths.X ?? 0).
    queryResult = {
        loading: false,
        data: { allComments: { totalAmount: 0, comments: [] } },
    }
    render(<Panel />)
    expect(document.body.textContent).not.toContain('NaN')
    unmount()

    // Array-shaped URL params (next-router multi-value): the first value wins.
    queryResult = {
        loading: false,
        data: withStats({ allComments: { totalAmount: 0, comments: [] } }),
    }
    routerQuery = { delka: ['long', 'short'], rok: ['2021', '2020'] }
    render(<Panel />)
    expect(queryVariables).toEqual({ offset: 0, limit: 10, length: 'LONG', year: 2021 })
})
