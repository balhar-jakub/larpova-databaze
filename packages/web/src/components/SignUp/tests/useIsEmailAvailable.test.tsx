/**
 * @jest-environment jsdom
 */
/**
 * useIsEmailAvailable: the availability check reports whether another user
 * already owns the email — and clears the state when the email is free
 * again (or belongs to the current user).
 */
import React from 'react'
import { render, renderHook, act, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

type QueryAnswer = { data: { userByEmail?: { id: string; email: string; name: string; nickname: string | null } | null } }

let queryAnswer: QueryAnswer = { data: { userByEmail: null } }
const queryCalls: Array<Record<string, unknown>> = []

jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({
        query: (opts: { variables?: Record<string, unknown> }) => {
            queryCalls.push(opts.variables ?? {})
            return Promise.resolve(queryAnswer)
        },
    }),
    ApolloProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let useIsEmailAvailable: typeof import('src/hooks/useIsEmailAvailable')['useIsEmailAvailable']

beforeAll(async () => {
    useIsEmailAvailable = (await import('src/hooks/useIsEmailAvailable')).useIsEmailAvailable
})

beforeEach(() => {
    cleanup()
    queryCalls.length = 0
    queryAnswer = { data: { userByEmail: null } }
})

describe('useIsEmailAvailable', () => {
    it('reports an available email and clears the used-by state', async () => {
        const { result } = renderHook(() => useIsEmailAvailable())

        let available = false
        await act(async () => {
            available = await result.current.isEmailAvailable('free@example.test')
        })

        expect(available).toBe(true)
        expect(result.current.usedByUser).toBeUndefined()
        expect(queryCalls[0]).toEqual({ email: 'free@example.test' })
    })

    it('reports a used email and stores the owner', async () => {
        queryAnswer = {
            data: { userByEmail: { id: '7', email: 'taken@example.test', name: 'Vlastník', nickname: null } },
        }
        const { result } = renderHook(() => useIsEmailAvailable())

        let available = true
        await act(async () => {
            available = await result.current.isEmailAvailable('taken@example.test')
        })

        expect(available).toBe(false)
        expect(result.current.usedByUser?.id).toBe('7')
    })

    it('treats the current user\'s own email as available', async () => {
        queryAnswer = {
            data: { userByEmail: { id: '7', email: 'mine@example.test', name: 'Já', nickname: null } },
        }
        const { result } = renderHook(() => useIsEmailAvailable())

        let available = false
        await act(async () => {
            available = await result.current.isEmailAvailable('mine@example.test', '7')
        })

        expect(available).toBe(true)
        expect(result.current.usedByUser).toBeUndefined()
    })

    it('skips the query for an empty email', async () => {
        const { result } = renderHook(() => useIsEmailAvailable())

        let available = false
        await act(async () => {
            available = await result.current.isEmailAvailable(undefined)
        })

        expect(available).toBe(true)
        expect(queryCalls.length).toBe(0)
    })
})
