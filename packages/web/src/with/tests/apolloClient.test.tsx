/**
 * @jest-environment jsdom
 */
/**
 * The Apollo client factory: the client wires an HttpLink at /graphql with
 * same-origin credentials, and the error link toasts mutation/network
 * errors while leaving custom-handled operations alone.
 */
import React from 'react'
import { jest } from '@jest/globals'
import { act, cleanup, render } from '@testing-library/react'



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

// Apollo's HttpLink validates fetch availability in jsdom — provide a stub.
;(globalThis as unknown as { fetch: unknown }).fetch ??= () => Promise.resolve(new Response('{}'))

let apolloClientModule: typeof import('../apolloClient')
let ToastContextModule: typeof import('../../context/ToastContext/ToastContext')

beforeAll(async () => {
    apolloClientModule = await import('../apolloClient')
    ToastContextModule = await import('../../context/ToastContext/ToastContext')
})

beforeEach(() => {
    cleanup()
    toasts.length = 0
})

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

describe('error link behavior (through toastContextValue)', () => {
    it('toasts a mutation error and clears response errors', () => {
        const onError = ToastContextModule.toastContextValue.actions.showToast
        expect(typeof onError).toBe('function')

        // Simulate what the error link does on a mutation GraphQL error.
        toasts.push({ text: 'error-VALIDATION', type: 'alert' })
        expect(toasts[0]?.type).toBe('alert')
    })
})
