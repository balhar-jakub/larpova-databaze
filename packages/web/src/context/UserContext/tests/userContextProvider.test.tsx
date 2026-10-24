/**
 * @jest-environment jsdom
 */
/**
 * The user context provider: loads the logged-in user into the context,
 * exposes undefined when logged out, and reload() refetches.
 */
import React from 'react'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let queryData: { loggedInUser?: unknown } | undefined
let refetches = 0

jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({
        data: queryData,
        loading: false,
        refetch: () => { refetches += 1; return Promise.resolve({ data: queryData }) },
    }),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))

let UserContextProvider: typeof import('../UserContextProvider')['default']
let UserContext: typeof import('../UserContext')['UserContext']

beforeAll(async () => {
    UserContextProvider = (await import('../UserContextProvider')).default
    UserContext = (await import('../UserContext')).UserContext
})

beforeEach(() => {
    cleanup()
    refetches = 0
    queryData = undefined
})

const Probe = () => {
    const user = React.useContext(UserContext)
    return (
        <div>
            <span data-testid="user-id">{user?.value?.id ?? 'anonymous'}</span>
            <span data-testid="user-role">{user?.value?.role ?? 'none'}</span>
            <button type="button" onClick={() => user?.actions.reload()}>reload</button>
        </div>
    )
}

describe('UserContextProvider', () => {
    it('exposes the logged-in user through the context', async () => {
        queryData = { loggedInUser: { __typename: 'User', id: 'u1', name: 'Jakub', nickname: 'Balda', role: 'ADMIN', image: null, gender: 'MALE' } }
        render(
            <UserContextProvider>
                <Probe />
            </UserContextProvider>,
        )
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getByTestId('user-id').textContent).toBe('u1')
        expect(screen.getByTestId('user-role').textContent).toBe('ADMIN')
    })

    it('exposes undefined for an anonymous visitor', async () => {
        render(
            <UserContextProvider>
                <Probe />
            </UserContextProvider>,
        )
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getByTestId('user-id').textContent).toBe('anonymous')
    })

    it('reloads the user via the context action', async () => {
        queryData = { loggedInUser: { __typename: 'User', id: 'u1', name: 'Jakub', nickname: null, role: 'USER', image: null, gender: null } }
        render(
            <UserContextProvider>
                <Probe />
            </UserContextProvider>,
        )
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        fireEvent.click(screen.getByText('reload'))
        await waitFor(() => expect(refetches).toBe(1))
    })
})
