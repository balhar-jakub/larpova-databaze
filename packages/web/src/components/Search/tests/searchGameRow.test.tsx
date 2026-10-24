/**
 * @jest-environment jsdom
 */
/**
 * The game row of the unified search: the name links to the game with the
 * query highlighted, the unrated hint, the match reason, and the label
 * list with its "+N more".
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
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string | null }; children?: React.ReactNode }) => (
        <a href={`/hra/${game.id}`}>{children}</a>
    ),
}))

let SearchGameRow: typeof import('../SearchGameRow')['SearchGameRow']

beforeAll(async () => {
    SearchGameRow = (await import('../SearchGameRow')).SearchGameRow
})

beforeEach(() => cleanup())

const game = (over: Record<string, unknown> = {}) => ({
    __typename: 'Game',
    id: 'g1',
    name: 'Dračí doupě',
    year: 2014,
    averageRating: 4.2,
    amountOfRatings: 25,
    labels: [{ __typename: 'Label', name: 'fantasy' }],
    authors: [{ __typename: 'User', name: 'Jakub' }],
    groupAuthor: null,
    ...over,
})

describe('SearchGameRow', () => {
    it('links the game name with the year and the stats', () => {
        render(<SearchGameRow game={game() as never} query="drac" />)

        const links = screen
            .getAllByText((_, el) => el?.textContent?.includes('Dračí doupě') ?? false)
            .filter(el => el.closest('a') !== null)
        expect(links[0].closest('a')?.getAttribute('href')).toBe('/hra/g1')
        // The meta line carries the year, the stats column the rounded rating.
        expect(screen.getByText('2014')).toBeTruthy()
        expect(screen.getByText('4 %')).toBeTruthy()
    })

    it('shows the unrated hint instead of a rating for games without enough ratings', () => {
        render(<SearchGameRow game={game({ averageRating: 0, amountOfRatings: 2 }) as never} query="drac" />)

        expect(screen.getByTestId('search.notRated')).toBeTruthy()
    })

    it('lists the labels with the rest collapsed behind a count', () => {
        render(
            <SearchGameRow
                game={game({ labels: [
                    { __typename: 'Label', name: 'fantasy' },
                    { __typename: 'Label', name: 'svět' },
                    { __typename: 'Label', name: 'legenda' },
                    { __typename: 'Label', name: ' další' },
                ] }) as never}
                query="drac"
            />,
        )

        expect(screen.getAllByText((_, el) => el?.textContent?.includes('fantasy') ?? false).length).toBeGreaterThan(0)
        // The fourth label collapses behind the plural count (more = 1).
        expect(screen.getByText('1 další štítek')).toBeTruthy()
    })

    it('joins the author names', () => {
        render(
            <SearchGameRow
                game={game({ authors: [
                    { __typename: 'User', name: 'Jakub' },
                    { __typename: 'User', name: 'Petra' },
                ] }) as never}
                query="drac"
            />,
        )

        expect(screen.getByText('od Jakub, Petra')).toBeTruthy()
    })
})
