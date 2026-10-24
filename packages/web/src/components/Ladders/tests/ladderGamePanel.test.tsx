/**
 * @jest-environment jsdom
 */
/**
 * A single ladder row: the rating box, the linked game name with the
 * year, and the comment/rating counts.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

jest.unstable_mockModule('../../common/GameRatingBox/GameRatingBox', () => ({
    GameRatingBox: ({ rating }: { rating?: number }) => <div data-testid="rating">{rating}</div>,
}))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string }; children?: React.ReactNode }) => (
        <a href={`/hra/${game.id}`}>{children ?? game.name}</a>
    ),
}))
jest.unstable_mockModule('../../common/Icons/Icons', () => ({
    IconNumComments: () => <span data-testid="commentsIcon" />,
    IconNumRatings: () => <span data-testid="ratingsIcon" />,
}))

let LadderGamePanel: typeof import('../LadderGamePanel').default

beforeAll(async () => {
    LadderGamePanel = (await import('../LadderGamePanel')).default
})

beforeEach(() => cleanup())

const game = {
    __typename: 'Game',
    id: 'g1',
    name: 'Dračí doupě',
    year: 2014,
    amountOfComments: 12,
    amountOfRatings: 34,
    averageRating: 5,
    totalRating: 170,
    labels: [{ __typename: 'Label', id: 'l1', name: 'svět' }],
}

describe('LadderGamePanel', () => {
    it('links the game and shows its year and counts', () => {
        render(<LadderGamePanel game={game as never} />)

        const link = screen.getByText('Dračí doupě').closest('a')
        expect(link?.getAttribute('href')).toBe('/hra/g1')
        // The counts render next to their icons.
        expect(document.body.textContent).toContain('12')
        expect(document.body.textContent).toContain('34')
        expect(screen.getByTestId('commentsIcon')).toBeTruthy()
        expect(screen.getByTestId('ratingsIcon')).toBeTruthy()
    })

    it('renders without a year', () => {
        render(<LadderGamePanel game={{ ...game, year: null } as never} />)

        expect(screen.getByText('Dračí doupě')).toBeTruthy()
    })
})
