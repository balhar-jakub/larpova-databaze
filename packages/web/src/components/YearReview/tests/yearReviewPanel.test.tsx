/**
 * @jest-environment jsdom
 */
/**
 * The year-review page ("Ročenka"): one query, then the featured games
 * podium, runner-ups, new games strip, quotes and articles. These tests
 * pin the loading / error / data states and that every section renders
 * its rows from the query result.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

let queryResult: Promise<{ data?: unknown }> | undefined
let queryError: Error | undefined

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({
        query: () => (queryError ? Promise.reject(queryError) : queryResult),
    }),
}))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string | null }; children: React.ReactNode }) => (
        <a href={`/larp/${game.id}`}>{children ?? game.name}</a>
    ),
}))
jest.unstable_mockModule('../../common/GameRatingBox/GameRatingBox', () => ({
    GameRatingBox: ({ averageRating }: { averageRating?: number | null }) => <span>{averageRating ?? ''}</span>,
}))
jest.unstable_mockModule('../../common/ProfileImage/ProfileImage', () => ({
    ProfileImage: ({ userId }: { userId?: string }) => <span data-testid={`avatar-${userId}`} />,
}))

let YearReviewPanel: typeof import('../YearReviewPanel')['default']

beforeAll(async () => {
    YearReviewPanel = (await import('../YearReviewPanel')).default
})

beforeEach(() => {
    queryResult = undefined
    queryError = undefined
})

const author = (id: string) => ({ __typename: 'User', id, name: `Autor ${id}`, image: null })

const game = (id: string, name: string, over: Record<string, unknown> = {}) => ({
    __typename: 'Game',
    id,
    name,
    averageRating: 85,
    amountOfRatings: 10,
    authors: [author(`${id}-a`)],
    labels: [{ __typename: 'Label', id: 'l1', name: 'komorní' }],
    coverImage: null,
    ...over,
})

const reviewData = (over: Record<string, unknown> = {}) => ({
    __typename: 'YearReview',
    featuredGames: [{ __typename: 'FeaturedGameRow', game: game('1', 'Nejlepší hra'), votesInYear: 12 }],
    runnerUpGames: [{ __typename: 'RunnerUpGameRow', game: game('2', 'Druhá hra'), votesInYear: 5 }],
    newGames: [game('3', 'Nová hra', { added: '2026-03-01' })],
    quotes: [
        {
            __typename: 'QuoteRow',
            id: 'q1',
            text: 'Byla to perfektní hra, která nás držela až do konce a ještě dál.',
            user: { __typename: 'User', id: 'u1', name: 'Komentátor', image: null },
            game: game('1', 'Nejlepší hra'),
            added: '2026-05-01',
        },
    ],
    articles: [
        {
            __typename: 'ArticleRow',
            id: 'a1',
            title: 'Reportáž z konventu',
            url: 'https://example.test/reportaz',
            publishedAt: '2026-02-01',
            authors: 'Redakce',
            categories: ['Festivaly'],
            perex: 'Jak to bylo na konventu.',
        },
    ],
    ...over,
})

describe('YearReviewPanel', () => {
    it('shows the loading state until the query answers', () => {
        queryResult = new Promise(() => undefined)
        render(<YearReviewPanel year={2026} />)

        expect(screen.getByText('loading')).toBeTruthy()
        expect(screen.getByTestId('yearReview.page')).toBeTruthy()
    })

    it('shows the error message when the query fails', async () => {
        queryError = new Error('Síť spadla')
        render(<YearReviewPanel year={2026} />)

        await waitFor(() => expect(screen.getByText('Síť spadla')).toBeTruthy())
        expect(screen.getByText(translate(cs, 'YearReview.pageTitle', { year: 2026 }))).toBeTruthy()
    })

    it('renders all sections from the data', async () => {
        queryResult = Promise.resolve({ data: { yearReview: reviewData() } })
        render(<YearReviewPanel year={2026} />)

        // Featured and runner-up games (the featured one also appears in the quote)
        expect((await screen.findAllByText('Nejlepší hra')).length).toBeGreaterThan(0)
        expect(screen.getByText('Druhá hra')).toBeTruthy()
        // New games strip
        expect(screen.getByText('Nová hra')).toBeTruthy()
        // Quote with its author and game link
        expect(screen.getByText(translate(cs, 'YearReview.quotesTitle'))).toBeTruthy()
        expect(screen.getByTestId('avatar-u1')).toBeTruthy()
        // Articles
        expect(screen.getByText('Reportáž z konventu')).toBeTruthy()
    })

    it('covers a featured game with its image and ellipsizes long quotes', async () => {
        const longText = `${'Nejlepší hra roku. '.repeat(20)}a ještě něco za limitem`
        queryResult = Promise.resolve({
            data: {
                yearReview: reviewData({
                    featuredGames: [
                        {
                            __typename: 'FeaturedGameRow',
                            game: game('1', 'Nejlepší hra', { coverImage: { __typename: 'Image', id: 'img1' } }),
                            votesInYear: 12,
                        },
                    ],
                    quotes: [
                        {
                            __typename: 'QuoteRow',
                            id: 'q1',
                            text: longText,
                            user: { __typename: 'User', id: 'u1', name: 'Komentátor', image: null },
                            game: game('1', 'Nejlepší hra'),
                            added: '2026-05-01',
                        },
                    ],
                }),
            },
        })
        render(<YearReviewPanel year={2026} />)

        // The cover image URL is built the catalog way.
        const img = (await screen.findAllByText('Nejlepší hra')) && document.querySelector('img[src*="game-image"]')
        expect(img?.getAttribute('src')).toBe('/game-image/?id=1&imageId=img1')

        // The long quote is cut at a word boundary with an ellipsis.
        const excerpt = document.body.textContent ?? ''
        expect(excerpt).toContain('…')
    })

    it('hides the quotes and articles sections when the data has none', async () => {
        queryResult = Promise.resolve({
            data: { yearReview: reviewData({ quotes: [], articles: [] }) },
        })
        render(<YearReviewPanel year={2026} />)

        await screen.findAllByText('Nejlepší hra')
        expect(screen.queryByText(translate(cs, 'YearReview.quotesTitle'))).toBeNull()
        expect(screen.queryByText(translate(cs, 'YearReview.articlesTitle'))).toBeNull()
    })

    it('shows the +N more authors badge when a featured game has more than 5', async () => {
        queryResult = Promise.resolve({
            data: {
                yearReview: reviewData({
                    featuredGames: [
                        {
                            __typename: 'FeaturedGameRow',
                            game: game('1', 'Kolektivní hra', {
                                authors: Array.from({ length: 8 }, (_, i) => author(String(i))),
                            }),
                            votesInYear: 9,
                        },
                    ],
                }),
            },
        })
        render(<YearReviewPanel year={2026} />)

        await screen.findAllByText('Kolektivní hra')
        expect(screen.getAllByText((_, el) => Boolean(el?.textContent?.includes('+3 další'))).length).toBeGreaterThan(0)
        // 5 author avatars shown (the quote's user avatar is a 6th element)
        const ids = screen.getAllByTestId(/^avatar-/).map((a) => a.getAttribute('data-testid'))
        expect(ids.filter((id) => /^avatar-\d$/.test(id ?? '')).length).toBe(5)
        expect(ids).toContain('avatar-u1')
    })
})
