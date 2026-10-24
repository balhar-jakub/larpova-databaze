/**
 * @jest-environment jsdom
 */
/**
 * The Apollo client factory: the client wires the error link in front of
 * the HttpLink at /graphql. Mutation and network errors are toasted
 * through the module-level toast context and cleared from the response;
 * operations with their own error handling (ChangePassword) are left
 * alone, and plain reads surface their errors without a toast.
 */
import React from 'react'
import { jest } from '@jest/globals'
import { cleanup } from '@testing-library/react'
import { gql } from '@apollo/client/index.js'

const toasts: Array<{ text: unknown; type: string }> = []

// The real error link writes through the module-level toastContextValue.
jest.unstable_mockModule('../../context/ToastContext/ToastContext', () => ({
    toastContextValue: { actions: { showToast: (text: unknown, type: string) => { toasts.push({ text, type }) } } },
    ToastContext: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> },
}))
jest.unstable_mockModule('../../components/common/GraphQLErrorContent/GraphQLErrorContent', () => ({
    default: ({ errorClass }: { errorClass: string }) => <div>{`error-${errorClass}`}</div>,
    PropsFromGraphQLError: (error: unknown) => {
        const e = error as { extensions?: { errorClass?: string; valuePath?: string } }
        return { errorClass: e?.extensions?.errorClass ?? 'UNKNOWN', valuePath: e?.extensions?.valuePath }
    },
}))

// jsdom has no Response global; give fetch a minimal stand-in.
class StubResponse {
    readonly ok: boolean
    readonly status: number
    readonly body: string
    constructor(body: string, init?: { status?: number }) {
        this.body = body
        this.status = init?.status ?? 200
        this.ok = this.status < 400
    }
    async json() { return JSON.parse(this.body) }
    async text() { return this.body }
}

// The transport is stubbed: the fetch behind HttpLink answers with the
// configured payload or rejects like a dead network.
let fetchAnswer: () => Promise<StubResponse> = () => Promise.resolve(new StubResponse('{}'))

const realFetch = globalThis.fetch
;(globalThis as unknown as { fetch: unknown }).fetch = ((...args: unknown[]) => fetchAnswer()) as unknown

let apolloClientModule: typeof import('../apolloClient')

beforeAll(async () => {
    apolloClientModule = await import('../apolloClient')
})

beforeEach(() => {
    cleanup()
    toasts.length = 0
    fetchAnswer = () => Promise.resolve(new StubResponse('{}'))
})

afterAll(() => {
    ;(globalThis as unknown as { fetch: unknown }).fetch = realFetch
})

const MUTATION = gql`
    mutation AddLabel($input: LabelInput!) {
        addLabel(input: $input) {
            id
        }
    }
`

const QUERY = gql`
    query Games {
        games {
            id
        }
    }
`

describe('makeClient', () => {
    it('creates a client with an http link to /graphql', () => {
        const client = apolloClientModule.makeClient()
        expect(client).toBeTruthy()
        expect(client.link).toBeTruthy()
        expect((client.cache as unknown as { addNoOpCache?: unknown }).constructor.name).toContain('InMemoryCache')
    })

    it('returns a working client instance per call', () => {
        const a = apolloClientModule.makeClient()
        const b = apolloClientModule.makeClient()
        expect(a).not.toBe(b)
    })
})

describe('the error link is wired into the client', () => {
    it('toasts a mutation GraphQL error and clears it from the response', async () => {
        fetchAnswer = () => Promise.resolve(new StubResponse(JSON.stringify({
            errors: [{ message: 'nope', extensions: { errorClass: 'VALIDATION' } }],
        }), { status: 200 }))

        const client = apolloClientModule.makeClient()
        const result = await client.mutate({ mutation: MUTATION, variables: { input: {} } })

        expect(toasts.length).toBe(1)
        expect(toasts[0]?.type).toBe('alert')
        // The error link swallows the errors so the caller does not throw.
        expect(result.errors).toBeUndefined()
    })

    it('toasts a network error', async () => {
        fetchAnswer = () => Promise.reject(new TypeError('network down'))

        const client = apolloClientModule.makeClient()
        await client.query({ query: QUERY, fetchPolicy: 'network-only' }).catch(() => undefined)

        expect(toasts.length).toBe(1)
        expect(toasts[0]?.type).toBe('alert')
    })

    it('leaves query GraphQL errors to the caller (no toast for reads)', async () => {
        fetchAnswer = () => Promise.resolve(new StubResponse(JSON.stringify({
            errors: [{ message: 'nope', extensions: { errorClass: 'VALIDATION' } }],
        }), { status: 200 }))

        const client = apolloClientModule.makeClient()
        await client.query({ query: QUERY, fetchPolicy: 'network-only' }).catch(() => undefined)

        expect(toasts.length).toBe(0)
    })

    it('leaves ChangePassword errors to the operation (no toast)', async () => {
        fetchAnswer = () => Promise.resolve(new StubResponse(JSON.stringify({
            errors: [{ message: 'bad old password', extensions: { errorClass: 'VALIDATION', path: 'oldPassword' } }],
        }), { status: 200 }))

        const client = apolloClientModule.makeClient()
        // The operation keeps its error (it does its own handling), so the
        // promise rejects with it.
        await expect(client.mutate({
            mutation: gql`
                mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
                    changePassword(oldPassword: $oldPassword, newPassword: $newPassword) {
                        id
                    }
                }
            `,
            variables: { oldPassword: 'x', newPassword: 'y' },
        })).rejects.toThrow('bad old password')

        expect(toasts.length).toBe(0)
    })
})
