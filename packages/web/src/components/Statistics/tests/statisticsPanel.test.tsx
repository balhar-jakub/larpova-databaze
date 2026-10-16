/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The statistics page renders from one `statistics` query. These tests pin
 * the honesty rules of the design: the KPI totals, the raw-vs-unique event
 * shadow, the 2014 import drawn separately, the "Ročenky" cards linking to
 * the yearbook pages — and that the import note stays hidden when the data
 * has no imported votes (a fresh database).
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

let queryAnswer: Promise<{ data: Record<string, unknown> }> = Promise.resolve({ data: {} })

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options), locale: 'cs', ready: true }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({ query: () => queryAnswer }),
}))
jest.unstable_mockModule('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string | null }, children: React.ReactNode }) => (
        <a href={`/larp/${game.id}`}>{children ?? game.name}</a>
    ),
}))

let StatisticsPanel: typeof import('../StatisticsPanel').default

beforeAll(async () => {
    StatisticsPanel = (await import('../StatisticsPanel')).default
})

const year = (over: Record<string, unknown> = {}) => ({
    year: 2025,
    events: 3,
    eventsRaw: 3,
    newGames: 1,
    ratings: 4,
    importedRatings: 0,
    averageRating: 8.5,
    bands: [2, 1, 1, 0, 0],
    topGames: [],
    ...over,
})

const statisticsData = (years: Record<string, unknown>[]) => ({
    gamesTotal: 1513,
    eventsTotal: 1020,
    ratingsTotal: 17029,
    commentsTotal: 4806,
    years,
})

describe('StatisticsPanel', () => {
    it('renders the KPI totals from the query', async () => {
        queryAnswer = Promise.resolve({ data: { statistics: statisticsData([year()]) } })
        render(<StatisticsPanel />)
        await screen.findByText('1 513')
        expect(screen.getByText('1 020')).toBeTruthy()
        expect(screen.getByText('17 029')).toBeTruthy()
        expect(screen.getByText('4 806')).toBeTruthy()
        expect(screen.getByText('Kolik akcí proběhlo')).toBeTruthy()
    })

    it('renders all five charts and the "Ročenky" cards', async () => {
        queryAnswer = Promise.resolve({
            data: {
                statistics: statisticsData([
                    year({ year: 2025, ratings: 384 }),
                    year({ year: 2024, ratings: 120 }),
                ]),
            },
        })
        render(<StatisticsPanel />)
        await screen.findByText('Ročenka 2025')
        expect(screen.getByTestId('statistics.eventsChart')).toBeTruthy()
        expect(screen.getByTestId('statistics.bandsChart')).toBeTruthy()
        expect(screen.getByTestId('statistics.averageChart')).toBeTruthy()
        expect(screen.getByTestId('statistics.votesChart')).toBeTruthy()
        expect(screen.getByTestId('statistics.newGamesChart')).toBeTruthy()
        expect(screen.getByTestId('statistics.yearbooks.2025')).toBeTruthy()
        expect(screen.getByTestId('statistics.yearbooks.2024')).toBeTruthy()
        // Each card links to its yearbook page.
        expect(screen.getByTestId('statistics.yearbooks.2025').getAttribute('href')).toBe('/rocenka/2025')
    })

    it('shows the import note when the data has imported votes', async () => {
        queryAnswer = Promise.resolve({
            data: {
                statistics: statisticsData([
                    year({ year: 2014, ratings: 7307, importedRatings: 5778, averageRating: 7.53, bands: [2540, 2818, 1429, 411, 109] }),
                ]),
            },
        })
        render(<StatisticsPanel />)
        await screen.findByText('Jak jsme k číslům přišli')
        const notes = screen.getByTestId('statistics.notes')
        // `Intl` groups with a non-breaking space, so compare loosely.
        expect(notes.textContent).toContain('778 hlasů roku 2014')
        expect(notes.textContent).toContain('1. 6. 2014')
    })

    it('hides the import note when the data has no imported votes', async () => {
        queryAnswer = Promise.resolve({ data: { statistics: statisticsData([year()]) } })
        render(<StatisticsPanel />)
        await screen.findByText('Kolik akcí proběhlo')
        const notes = screen.getByTestId('statistics.notes')
        expect(notes.textContent).not.toContain('1. 6. 2014')
    })

    it('omits pre-2015 years from all charts, not just the rating ones', async () => {
        queryAnswer = Promise.resolve({
            data: {
                statistics: statisticsData([
                    year({ year: 2014, ratings: 7307, importedRatings: 5778, averageRating: 7.53, bands: [2540, 2818, 1429, 411, 109], events: 1, newGames: 80 }),
                    year(),
                ]),
            },
        })
        render(<StatisticsPanel />)
        await screen.findByText('Kolik akcí proběhlo')
        // No chart renders 2014 — the import year stays in the honesty notes only.
        expect(screen.getByTestId('statistics.eventsChart').textContent).not.toContain('2014')
        expect(screen.getByTestId('statistics.bandsChart').textContent).not.toContain('2014')
        expect(screen.getByTestId('statistics.averageChart').textContent).not.toContain('14')
        expect(screen.getByTestId('statistics.votesChart').textContent).not.toContain('14')
        expect(screen.getByTestId('statistics.newGamesChart').textContent).not.toContain('2014')
        expect(screen.queryByTestId('statistics.yearbooks.2014')).toBeNull()
    })

    it('renders the vote count on the "Ročenky" cards with Czech plurals', async () => {
        queryAnswer = Promise.resolve({
            data: {
                statistics: statisticsData([
                    year({ year: 2025, ratings: 384 }),
                    year({ year: 2023, ratings: 3 }),
                    year({ year: 2022, ratings: 1 }),
                ]),
            },
        })
        render(<StatisticsPanel />)
        await screen.findByText('Ročenka 2025')
        // 5+ votes → "hlasů", 2–4 → "hlasy", 1 → "hlas" (no "{{count}}× hlasů").
        expect(screen.getByText('384 hlasů v roce')).toBeTruthy()
        expect(screen.getByText('3 hlasy v roce')).toBeTruthy()
        expect(screen.getByText('1 hlas v roce')).toBeTruthy()
    })

    it('keeps the y-axis labels out of the first bar: bars start right of the label gutter', async () => {
        queryAnswer = Promise.resolve({
            data: {
                statistics: statisticsData([
                    year({ year: 2015, events: 1, eventsRaw: 2, newGames: 131, ratings: 2270, averageRating: 7.91, bands: [950, 920, 291, 81, 28] }),
                    year({ year: 2016, events: 2, eventsRaw: 2, newGames: 223, ratings: 1983, averageRating: 8.01, bands: [902, 700, 250, 80, 51] }),
                ]),
            },
        })
        render(<StatisticsPanel />)
        await screen.findByText('Kolik akcí proběhlo')
        // Every y-tick label is anchored "end" at PAD_L - 6, so its right edge is
        // that x. Every bar/point must start at or right of PAD_L — the labels'
        // gutter is never reached. Read from the rendered attributes (jsdom has
        // no getBBox).
        for (const id of ['statistics.eventsChart', 'statistics.bandsChart', 'statistics.votesChart', 'statistics.newGamesChart']) {
            const svg = screen.getByTestId(id)
            const anchors = [...svg.querySelectorAll('text')].filter((t) => t.getAttribute('text-anchor') === 'end')
            expect(anchors.length).toBeGreaterThan(0)
            const labelRight = Math.max(...anchors.map((t) => parseFloat(t.getAttribute('x') ?? '0')))
            const bars = [...svg.querySelectorAll('rect')].map((r) => parseFloat(r.getAttribute('x') ?? '0'))
            expect(bars.length).toBeGreaterThan(0)
            expect(Math.min(...bars)).toBeGreaterThanOrEqual(labelRight)
        }
        const avg = screen.getByTestId('statistics.averageChart')
        const avgAnchors = [...avg.querySelectorAll('text')].filter((t) => t.getAttribute('text-anchor') === 'end')
        const labelRight = Math.max(...avgAnchors.map((t) => parseFloat(t.getAttribute('x') ?? '0')))
        const points = [...avg.querySelectorAll('circle')].map((c) => parseFloat(c.getAttribute('cx') ?? '0') - 3.5)
        expect(Math.min(...points)).toBeGreaterThanOrEqual(labelRight)
    })
})
