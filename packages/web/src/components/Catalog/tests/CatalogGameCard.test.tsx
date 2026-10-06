import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, params?: { count?: number; name?: string }) =>
            params?.count != null ? `${key}:${params.count}` : key,
    }),
}))

// The real link needs a Next router; the card is what is under test here.
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <a className={className} href="/larp/test">
            {children}
        </a>
    ),
}))

let CatalogGameCard: typeof import('../CatalogGameCard').default

beforeAll(async () => {
    CatalogGameCard = (await import('../CatalogGameCard')).default
})

const baseGame = {
    __typename: 'Game' as const,
    id: '659',
    name: 'Legie: Sibiřský příběh',
    year: 2014,
    hours: null,
    days: 2,
    players: 54,
    amountOfComments: 154,
    amountOfRatings: 240,
    amountOfPlayed: 210,
    averageRating: 94.4,
    coverImage: { __typename: 'Image' as const, id: '184916' },
    labels: [
        { __typename: 'Label' as const, id: '2', name: 'dramatický' },
        { __typename: 'Label' as const, id: '3', name: 'historický' },
    ],
}

describe('CatalogGameCard', () => {
    it('links to the game and shows the facts the database has', () => {
        render(<CatalogGameCard game={baseGame} />)

        expect(screen.getByRole('link', { name: 'Legie: Sibiřský příběh' })).toBeTruthy()
        // year · days · players — each through the plural keys of Game.*
        expect(screen.getByText('Game.year:2014 · Game.days:2 · Game.players:54')).toBeTruthy()
        expect(screen.getByText('dramatický')).toBeTruthy()
        expect(screen.getByText('historický')).toBeTruthy()
    })

    it('shows the recommendation square derived from the average rating', () => {
        const { container } = render(<CatalogGameCard game={baseGame} />)

        // Legie has 94.4 % from 240 ratings — the strongest level.
        const rating = container.querySelector('[data-testid="gameRatingBox.wrapper"]')
        expect(rating?.getAttribute('aria-label')).toBe('Rating.stronglyRecommended')
        expect(rating?.querySelector('svg')?.getAttribute('data-icon')).toBe('thumbs-up')
    })

    it('renders the cover image of the game', () => {
        const { container } = render(<CatalogGameCard game={baseGame} />)

        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            '/game-image/?id=659&imageId=184916',
        )
    })

    it('falls back to initials when a game has no cover image', () => {
        const { container } = render(<CatalogGameCard game={{ ...baseGame, coverImage: null }} />)

        expect(container.querySelector('img')).toBeNull()
        expect(container.textContent).toContain('LS')
    })

    it('says so when the year or the duration is missing', () => {
        render(<CatalogGameCard game={{ ...baseGame, year: null, hours: null, days: null }} />)

        expect(screen.getByText(/Catalog\.card\.noYear/)).toBeTruthy()
        expect(screen.getByText(/Catalog\.card\.durationUnknown/)).toBeTruthy()
    })

    it('falls back to hours for games measured in hours only', () => {
        render(<CatalogGameCard game={{ ...baseGame, days: null, hours: 6 }} />)

        expect(screen.getByText(/Game\.hours:6/)).toBeTruthy()
    })

    it('counts ratings, comments and plays', () => {
        const { container } = render(<CatalogGameCard game={baseGame} />)

        expect(container.textContent).toContain('240x')
        expect(container.textContent).toContain('154x')
        expect(container.textContent).toContain('210x')
    })

    it('hides the play count for a game nobody played', () => {
        const { container } = render(<CatalogGameCard game={{ ...baseGame, amountOfPlayed: 0 }} />)

        expect(container.querySelectorAll('[title^="Catalog.card.played"]')).toHaveLength(0)
        expect(container.querySelectorAll('[title^="Catalog.card.ratings"]')).toHaveLength(1)
    })

    it('shows an unrated game as not rated', () => {
        const { container } = render(
            <CatalogGameCard
                game={{ ...baseGame, amountOfRatings: 0, averageRating: 0, amountOfPlayed: 0 }}
            />,
        )

        const rating = container.querySelector('[data-testid="gameRatingBox.wrapper"]')
        expect(rating?.getAttribute('aria-label')).toBe('Rating.notrated')
    })
})
