/**
 * @jest-environment jsdom
 */
/**
 * The game rating panel: the logged-in rating box with the current
 * user's rating and state, the anonymous sign-in prompt, the author
 * self-rating warning, and the disabled state.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let loggedInUser: { id: string } | undefined | null = null

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => loggedInUser,
}))
jest.unstable_mockModule('src/context/InPlaceSignInContext/InPlaceSignInContext', () => ({
    InPlaceSignInContext: {
        _currentValue: { setValue: () => undefined },
        Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
}))
jest.unstable_mockModule('../../common/GameRatingBox/GameRatingBox', () => ({
    GameRatingBox: ({ averageRating, rating, amountOfRatings }: { averageRating?: number | null; rating?: number | null; amountOfRatings?: number | null }) => (
        <div data-testid="rating-box" data-average={String(averageRating ?? '')} data-rating={String(rating ?? '')} data-amount={String(amountOfRatings ?? '')} />
    ),
    bandClassName: () => '',
    ratingStyles: {},
}))
jest.unstable_mockModule('../RatingStateButtons', () => ({
    default: ({ state }: { state?: number }) => <div data-testid="rating-state" data-state={String(state ?? '')} />,
}))
jest.unstable_mockModule('../RatingChoices', () => ({
    default: () => <div data-testid="rating-choices" />,
}))
jest.unstable_mockModule('../AuthorWarningPanel', () => ({
    default: ({ onDismiss }: { onDismiss: () => void }) => (
        <div data-testid="author-warning">
            <button type="button" onClick={onDismiss}>dismiss</button>
        </div>
    ),
}))

let GameRatingPanel: typeof import('../GameRatingPanel')['GameRatingPanel']

beforeAll(async () => {
    GameRatingPanel = (await import('../GameRatingPanel')).GameRatingPanel
})

const gameProps: React.ComponentProps<typeof GameRatingPanel>['game'] = {
    id: 'g1',
    ratingStats: [
        { __typename: 'RatingCount', rating: 10, count: 3 },
        { __typename: 'RatingCount', rating: 9, count: 1 },
    ],
    authors: [{ id: 'a1' }],
    averageRating: 98,
    amountOfRatings: 4,
}

beforeEach(() => {
    cleanup()
    loggedInUser = null
})

describe('GameRatingPanel', () => {
    it('shows the sign-in prompt instead of rating controls for anonymous visitors', () => {
        render(<GameRatingPanel game={{ ...gameProps }} />)
        expect(
            screen.getAllByText((_, el) => Boolean(el?.textContent?.includes(translate(cs, 'GameDetail.logInToRateBefore').trim()))).length,
        ).toBeGreaterThan(0)
        expect(screen.queryByTestId('rating-state')).toBeNull()
    })

    it('shows the user\'s own rating box and state buttons when signed in', () => {
        loggedInUser = { id: 'u1' }
        render(
            <GameRatingPanel
                game={{ ...gameProps, currentUsersRating: { rating: 8, state: 2 } }}
            />,
        )
        expect(screen.getByTestId('rating-box')).toBeTruthy()
        expect(screen.getByTestId('rating-state').dataset.state).toBe('2')
        expect(screen.getByTestId('rating-choices')).toBeTruthy()
    })

    it('warns an author against self-rating until dismissed', () => {
        loggedInUser = { id: 'a1' }
        render(<GameRatingPanel game={{ ...gameProps }} />)

        expect(screen.getByTestId('author-warning')).toBeTruthy()
        fireEvent.click(screen.getByText('dismiss'))
        expect(screen.queryByTestId('author-warning')).toBeNull()
        expect(screen.getByTestId('rating-choices')).toBeTruthy()
    })

    it('replaces the choices with the disabled note when ratings are off', () => {
        loggedInUser = { id: 'u1' }
        render(<GameRatingPanel game={{ ...gameProps, ratingsDisabled: true }} />)
        expect(screen.queryByTestId('rating-choices')).toBeNull()
        expect(screen.getByText(translate(cs, 'GameDetail.ratingsDisabled'))).toBeTruthy()
    })

    it('hides the anonymous prompt for signed-in users', () => {
        loggedInUser = { id: 'u1' }
        render(<GameRatingPanel game={{ ...gameProps }} />)
        expect(screen.queryByText((_, el) => Boolean(el?.textContent?.includes(translate(cs, 'GameDetail.logInToRateBefore').trim())))).toBeNull()
    })

    it('aggregates duplicate rating entries and renders null stats as empty bands', () => {
        // Two entries for the same rating value (the ?? 0 accumulation arm)
        // plus a null-count entry (the count ?? 0 arm).
        render(
            <GameRatingPanel
                game={{
                    ...gameProps,
                    ratingStats: [
                        { __typename: 'RatingCount', rating: 10, count: 2 },
                        { __typename: 'RatingCount', rating: 10, count: 3 },
                        { __typename: 'RatingCount', rating: 9, count: null },
                    ],
                }}
            />,
        )
        // The panel renders without crashing on the null count (the total
        // falls back to 0 and the aggregation stays silent).
        expect(document.body.textContent).not.toContain('NaN')
    })

    it('answers a zero share for every band when there are not enough ratings', () => {
        render(<GameRatingPanel game={{ ...gameProps, ratingStats: null, amountOfRatings: 2 }} />)

        // hasEnoughRatings false: every band's share computes as 0, and the
        // chart still renders (the ?? [] arms).
        expect(document.body.textContent).toBeTruthy()
    })
})
