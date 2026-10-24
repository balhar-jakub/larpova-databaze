/**
 * @jest-environment jsdom
 */
/**
 * The other-user profile container: fetches the user over the raw
 * GraphQL endpoint, hands it to the profile panel, and cancels stale
 * answers when the user id changes mid-flight.
 */
import React from 'react'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import { jest } from '@jest/globals'

const loadedUsers: Array<{ userId: string; commentsLimit: number }> = []
let fetchResult: Promise<unknown> = Promise.resolve({ data: { userById: { id: 'u1', name: 'Jakub' } } })
const rendered: Array<{ userId: string; user: unknown; profileOnly: boolean }> = []

jest.unstable_mockModule('../UserPagedCommentsPanel', () => ({ PAGE_SIZE: 10 }))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: undefined, loading: false }),
    useMutation: () => [() => Promise.resolve({ data: undefined }), { loading: false }],
    useApolloClient: () => ({}),
    gql: (strings: TemplateStringsArray) => strings.join(''),
}))
jest.unstable_mockModule('../UserProfilePanel', () => ({
    default: ({ userId, user, profileOnly }: { userId: string; user: unknown; profileOnly: boolean }) => {
        rendered.push({ userId, user, profileOnly })
        return <div data-testid="user-profile">{JSON.stringify(user ?? null)}</div>
    },
}))

// The container posts to /graphql directly.
const realFetch = globalThis.fetch
;(globalThis as unknown as { fetch: unknown }).fetch = ((_resource: unknown, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? '{}')
    loadedUsers.push({ userId: body.variables?.userId, commentsLimit: body.variables?.commentsLimit })
    return fetchResult.then(payload => ({ json: () => payload }))
}) as unknown

let OtherUserProfileContainer: typeof import('../OtherUserProfileContainer').default

beforeAll(async () => {
    OtherUserProfileContainer = (await import('../OtherUserProfileContainer')).default
})

beforeEach(() => {
    cleanup()
    loadedUsers.length = 0
    rendered.length = 0
    fetchResult = Promise.resolve({ data: { userById: { id: 'u1', name: 'Jakub' } } })
})

afterAll(() => {
    ;(globalThis as unknown as { fetch: unknown }).fetch = realFetch
})

describe('OtherUserProfileContainer', () => {
    it('fetches the user and renders the profile panel with the answer', async () => {
        render(<OtherUserProfileContainer userId="u1" />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(loadedUsers[0]).toEqual({ userId: 'u1', commentsLimit: 10 })
        expect(rendered.at(-1)).toEqual({ userId: 'u1', user: { id: 'u1', name: 'Jakub' }, profileOnly: true })
        expect(screen.getByTestId('user-profile').textContent).toContain('Jakub')
    })

    it('asks again with the new id when the user changes', async () => {
        const { rerender } = render(<OtherUserProfileContainer userId="u1" />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        rerender(<OtherUserProfileContainer userId="u2" />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(loadedUsers.map(entry => entry.userId)).toEqual(['u1', 'u2'])
    })

    it('keeps the panel usable when the API answers without a user', async () => {
        fetchResult = Promise.resolve({ data: { userById: null } })
        render(<OtherUserProfileContainer userId="missing" />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(rendered.at(-1)?.user).toBeUndefined()
        expect(screen.getByTestId('user-profile')).toBeTruthy()
    })
})
