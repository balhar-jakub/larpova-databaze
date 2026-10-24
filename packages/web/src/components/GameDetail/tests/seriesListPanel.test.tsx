/**
 * @jest-environment jsdom
 */
/**
 * The series instalment list: the header with the name and count, the
 * years summary, the instalments and the "this game" marker on the
 * current one.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('../../common/DetailListHeader/DetailListHeader', () => ({
    DetailListHeader: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}))
jest.unstable_mockModule('../../common/GameRatingBox/GameRatingBox', () => ({
    GameRatingBox: ({ rating }: { rating?: number }) => <span data-testid="rating">{rating}</span>,
}))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string }; children?: React.ReactNode }) => (
        <a href={`/hra/${game.id}`}>{children ?? game.name}</a>
    ),
}))

let SeriesListPanel: typeof import('../SeriesListPanel').SeriesListPanel

beforeAll(async () => {
    SeriesListPanel = (await import('../SeriesListPanel')).SeriesListPanel
})

beforeEach(() => cleanup())

const series = {
    __typename: 'Series',
    id: 's1',
    name: 'Dračí doupě',
    amountOfGames: 2,
    amountOfRatings: 10,
    amountOfPlayed: 4,
    firstYear: 2014,
    lastYear: 2016,
    games: [
        { __typename: 'Game', id: 'g1', name: 'Dračí doupě I', year: 2014, amountOfRatings: 5, averageRating: 4.5 },
        { __typename: 'Game', id: 'g2', name: 'Dračí doupě II', year: 2016, amountOfRatings: 5, averageRating: 5 },
    ],
}

describe('SeriesListPanel', () => {
    it('renders the header, the year range summary and both instalments', () => {
        render(<SeriesListPanel series={series as never} currentGameId="g1" />)

        expect(screen.getByText(`${translate(cs, 'GameDetail.series')}: Dračí doupě (2)`)).toBeTruthy()
        expect(screen.getByText(/2014–2016/, { exact: false })).toBeTruthy()
        expect(screen.getByText('Dračí doupě I')).toBeTruthy()
        expect(screen.getByText('Dračí doupě II')).toBeTruthy()
    })

    it('marks the current instalment', () => {
        render(<SeriesListPanel series={series as never} currentGameId="g2" />)

        expect(screen.getByText(translate(cs, 'GameDetail.seriesInstalment'))).toBeTruthy()
    })

    it('renders nothing without a series or instalments', () => {
        const { container } = render(<SeriesListPanel series={null} currentGameId="g1" />)
        expect(container.innerHTML).toBe('')

        cleanup()
        const empty = render(<SeriesListPanel series={{ ...series, games: [] } as never} currentGameId="g1" />)
        expect(empty.container.innerHTML).toBe('')
    })

    it('shows a single year without the range dash', () => {
        render(
            <SeriesListPanel
                series={{ ...series, firstYear: 2014, lastYear: 2014 } as never}
                currentGameId="g1"
            />,
        )

        expect(screen.getByText(/2014 ·/)).toBeTruthy()
    })

    it('renders a series with no first year as "?" and games with missing numbers', () => {
        render(
            <SeriesListPanel
                series={{
                    ...series,
                    firstYear: null,
                    name: null,
                    games: [
                        { __typename: 'Game', id: 'g3', name: 'Bez roku', year: null, amountOfRatings: null, averageRating: null },
                    ],
                } as never}
                currentGameId="g3"
            />,
        )

        // The header names the series as empty, the range as "?" (both ?? arms).
        expect(document.body.textContent).toContain(translate(cs, 'GameDetail.series'))
        expect(document.body.textContent).toContain('?')
    })
})
