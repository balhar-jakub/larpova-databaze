/**
 * @jest-environment jsdom
 */
/**
 * The sign-in panel: the email+password login mutation with store reset
 * and redirect (or stayOnPage), the wrong-credentials toast, and the
 * recovery / sign-up links.
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
let pushedRoute = ''
let mutationResult: Promise<{ data?: unknown }> = Promise.resolve({ data: {} })
let resetStoreCalls = 0
let pathname = '/prihlaseni'
let onSuccessCalls = 0

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({ resetStore: () => { resetStoreCalls += 1 } }),
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        mutationCalls.push(opts)
        return mutationResult
    }, { loading: false }],
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ pathname, route: pathname, push: () => undefined }),
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = {
            homepage: () => '/',
            signUp: () => ({ href: '/registrace', as: '/registrace' }),
            recoverPasswordStart: () => ({ href: '/obnova-hesla', as: '/obnova-hesla' }),
        }
        return { ...routes, push: (url: string) => { pushedRoute = url } }
    },
}))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({
    useFocusInput: () => ({ current: null }),
}))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('src/hooks/useHideInPlaceLogin', () => ({
    useHideInPlaceLogin: () => () => {},
}))
jest.unstable_mockModule('../../common/FormPageRow/FormPageRow', () => ({
    default: ({ children, headerText }: { children: React.ReactNode; headerText?: string }) => (
        <div><h1>{headerText}</h1>{children}</div>
    ),
}))
jest.unstable_mockModule('../GoogleSignInButton', () => ({ GoogleSignInButton: () => <div data-testid="google" /> }))
jest.unstable_mockModule('../EmailLoginForm', () => ({ EmailLoginForm: () => <div data-testid="email-login" /> }))
jest.unstable_mockModule('../../common/TextLink/TextLink', () => ({
    TextLink: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
        <a href="/x" onClick={onClick}>{children}</a>
    ),
}))
jest.unstable_mockModule('../../common/SubmitButton/SubmitButton', () => ({
    default: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}))

let SignInPanel: typeof import('../SignInPanel')['default']

beforeAll(async () => {
    SignInPanel = (await import('../SignInPanel')).default
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    pushedRoute = ''
    resetStoreCalls = 0
    onSuccessCalls = 0
    pathname = '/prihlaseni'
    mutationResult = Promise.resolve({ data: {} })
})

const fillAndSubmit = () => {
    fireEvent.change(screen.getByPlaceholderText(translate(cs, 'SignIn.email')), { target: { value: 'jakub@example.test' } })
    fireEvent.change(screen.getByPlaceholderText(translate(cs, 'SignIn.password')), { target: { value: 'heslo' } })
    fireEvent.submit(document.querySelector('form')!)
}

describe('SignInPanel', () => {
    it('renders the google button, email login and both links', () => {
        render(<SignInPanel />)
        expect(screen.getByTestId('google')).toBeTruthy()
        expect(screen.getByTestId('email-login')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'SignIn.forgotPassword'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'SignIn.signUp'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'SignIn.header'))).toBeTruthy()
    })

    it('logs in, resets the store and redirects to the homepage', async () => {
        mutationResult = Promise.resolve({ data: { user: { logIn: { id: '1' } } } })
        render(<SignInPanel />)

        fillAndSubmit()

        await waitFor(() => expect(pushedRoute).toBe('/'))
        expect(mutationCalls[0]?.variables).toEqual({ userName: 'jakub@example.test', password: 'heslo' })
        expect(resetStoreCalls).toBe(1)
    })

    it('stays on the page when stayOnPage is set and the route is neutral', async () => {
        mutationResult = Promise.resolve({ data: { user: { logIn: { id: '1' } } } })
        render(<SignInPanel stayOnPage />)

        fillAndSubmit()

        await waitFor(() => expect(resetStoreCalls).toBe(1))
        expect(pushedRoute).toBe('')
    })

    it('redirects from the sign-up page even with stayOnPage', async () => {
        pathname = '/registrace'
        mutationResult = Promise.resolve({ data: { user: { logIn: { id: '1' } } } })
        render(<SignInPanel stayOnPage />)

        fillAndSubmit()

        await waitFor(() => expect(pushedRoute).toBe('/'))
    })

    it('shows the error toast when the login fails', async () => {
        mutationResult = Promise.resolve({ data: { user: { logIn: null } } })
        render(<SignInPanel />)

        fillAndSubmit()

        await waitFor(() => expect(toasts[0]?.type).toBe('alert'))
        expect(pushedRoute).toBe('')
    })

    it('calls onSuccess after a successful login', async () => {
        mutationResult = Promise.resolve({ data: { user: { logIn: { id: '1' } } } })
        render(<SignInPanel stayOnPage onSuccess={() => { onSuccessCalls += 1 }} />)

        fillAndSubmit()

        await waitFor(() => expect(onSuccessCalls).toBe(1))
    })
})
