/**
 * @jest-environment jsdom
 */
/**
 * The current-user profile container: loads the logged-in user over the
 * Apollo cache and hands it to the profile panel keyed by its id.
 */
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const rendered: Array<{ userId?: string; user: unknown }> = []

jest.unstable_mockModule('../UserPagedCommentsPanel', () => ({ PAGE_SIZE: 10 }))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: (_query: unknown, opts: { variables?: Record<string, unknown> }) => {
        variablesSeen.push(opts.variables)
        return { data: queryData, loading: false }
    },
    useMutation: () => [() => Promise.resolve({ data: undefined }), { loading: false }],
    gql: (strings: TemplateStringsArray) => strings.join(''),
}))
jest.unstable_mockModule('../UserProfilePanel', () => ({
    default: ({ userId, user }: { userId?: string; user: unknown }) => {
        rendered.push({ userId, user })
        return <div data-testid="user-profile" />
    },
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))

const variablesSeen: Array<Record<string, unknown> | undefined> = []
let queryData: Record<string, unknown> | undefined = undefined

let CurrentUserProfileContainer: typeof import('../CurrentUserProfileContainer').default

beforeAll(async () => {
    CurrentUserProfileContainer = (await import('../CurrentUserProfileContainer')).default
})

beforeEach(() => {
    cleanup()
    rendered.length = 0
    variablesSeen.length = 0
    queryData = undefined
})

describe('CurrentUserProfileContainer', () => {
    it('asks for the logged-in user with the page-size comment limit', () => {
        render(<CurrentUserProfileContainer />)

        expect(variablesSeen[0]).toEqual({ commentsLimit: 10 })
        // Without data the panel gets no ids.
        expect(rendered[0]).toEqual({ userId: undefined, user: undefined })
    })

    it('hands the logged-in user to the profile panel', () => {
        queryData = { loggedInUser: { id: 'u1', name: 'Jakub' } }

        render(<CurrentUserProfileContainer />)

        expect(rendered[0].userId).toBe('u1')
        expect((rendered[0].user as { name: string }).name).toBe('Jakub')
    })
})
