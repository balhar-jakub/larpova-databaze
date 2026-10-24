/**
 * @jest-environment jsdom
 */
/**
 * The ratings list panel: ratings sorted descending, recommendation
 * labels, delete via the Apollo client with a toast and the row
 * dimming/deleted state.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const mutationCalls: Array<{ variables?: Record<string, unknown> }> = []
const toasts: Array<{ text: string; type: string }> = []
const deleteCallbacks: Array<boolean> = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({
        mutate: (opts: { variables?: Record<string, unknown> }) => {
            mutationCalls.push(opts)
            return Promise.resolve({ data: { game: { deleteRating: true } } })
        },
    }),
}))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('../../common/UserLink/UserLink', () => ({
    default: ({ userId, children }: { userId: string; children?: React.ReactNode }) => (
        <a href={`/profil/${userId}`}>{children ?? userId}</a>
    ),
}))
jest.unstable_mockModule('../../common/DetailListHeader/DetailListHeader', () => ({
    DetailListHeader: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))
jest.unstable_mockModule('../../common/Icons/Icons', () => ({ IconTrash: () => <svg data-testid="icon-trash" /> }))
jest.unstable_mockModule('src/utils/ratingUtils', () => ({
    MIN_NUM_RATINGS: 1,
    RATING_BANDS: [],
    recommendationKey: (n: number) => `Recommendation.${n}`,
    getRecommendationForTenPointRating: (rating: number | null | undefined) => Math.round((rating ?? 0) / 10),
}))

let RatingsListPanel: typeof import('../RatingsListPanel')['default']

beforeAll(async () => {
    RatingsListPanel = (await import('../RatingsListPanel')).default
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    deleteCallbacks.length = 0
})

const ratings = [
    { __typename: 'Rating', id: 'r1', rating: 80, user: { __typename: 'User', id: 'u1', name: 'Jakub' } },
    { __typename: 'Rating', id: 'r2', rating: 100, user: { __typename: 'User', id: 'u2', name: 'Jana' } },
    { __typename: 'Rating', id: 'r3', rating: null, user: { __typename: 'User', id: 'u3', name: 'Petr' } },
]

describe('RatingsListPanel', () => {
    it('renders the header, the rater links and recommendation labels, skipping unrated', () => {
        render(<RatingsListPanel gameId="g1" ratings={ratings as never} onRatingDeleted={() => deleteCallbacks.push(true)} />)

        expect(screen.getByText(translate(cs, 'GameDetail.ratings'))).toBeTruthy()
        expect(document.querySelector('a[href="/profil/u1"]')).toBeTruthy()
        expect(document.querySelector('a[href="/profil/u2"]')).toBeTruthy()
        // r3 has rating null -> filtered out of the list entirely
        expect(document.querySelector('a[href="/profil/u3"]')).toBeNull()
    })

    it('deletes a rating through the Apollo client and toasts', async () => {
        render(<RatingsListPanel gameId="g1" ratings={ratings as never} onRatingDeleted={() => deleteCallbacks.push(true)} />)

        // Ratings sort descending: the first trash button belongs to r2 (100).
        const buttons = screen.getAllByTestId('icon-trash')
        fireEvent.click(buttons[0])

        await waitFor(() => expect(mutationCalls[0]?.variables).toEqual({ gameId: 'g1', userId: 'u2' }))
        expect(toasts[0]).toEqual({ text: translate(cs, 'GameDetail.ratingDeleted'), type: 'success' })
        expect(deleteCallbacks).toEqual([true])
    })
})
