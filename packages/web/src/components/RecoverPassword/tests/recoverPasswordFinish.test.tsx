/**
 * @jest-environment jsdom
 */
/**
 * The recover-password finish page: the new-password form, the mismatch
 * validation, the mutation with the token, the error branch and the
 * redirect home on success. Plus useRoutes' URL builders against a mocked
 * next/router.
 */
import React from 'react'
import { render, renderHook, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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
let mutateResult: Promise<unknown> = Promise.resolve({})
let resetStoreCalls = 0
const routerPushes: Array<{ href: string; as: string }> = []

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
            return mutateResult
        },
        resetStore: () => {
            resetStoreCalls += 1
            return Promise.resolve()
        },
    }),
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: (href: string, as: string) => { routerPushes.push({ href, as }) }, pathname: '/', query: {} }),
}))
// useRoutes stays REAL — the RecoverPasswordFinish tests exercise it through
// the mocked next/router (push records href), and the useRoutes tests below
// assert the real URL builders.
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({ useFocusInput: () => ({ current: null }) }))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('../../common/FormPageRow/FormPageRow', () => ({
    default: ({ children, headerText }: { children: React.ReactNode; headerText?: string }) => (
        <div><h1>{headerText}</h1>{children}</div>
    ),
}))
jest.unstable_mockModule('../../common/SubmitButton/SubmitButton', () => ({
    default: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}))

let RecoverPasswordFinish: typeof import('../RecoverPasswordFinish')['default']
let useRoutes: typeof import('../../../hooks/useRoutes')['useRoutes']
let LadderType: typeof import('../../../graphql/__generated__/typescript-operations')['LadderType']

beforeAll(async () => {
    RecoverPasswordFinish = (await import('../RecoverPasswordFinish')).default
    useRoutes = (await import('src/hooks/useRoutes')).useRoutes
    LadderType = (await import('../../../graphql/__generated__/typescript-operations')).LadderType
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    resetStoreCalls = 0
    routerPushes.length = 0
    mutateResult = Promise.resolve({})
})

describe('RecoverPasswordFinish', () => {
    const fillAndSubmit = () => {
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'RecoverPassword.password')), { target: { value: 'novéheslo' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'RecoverPassword.passwordConfirmation')), { target: { value: 'novéheslo' } })
        fireEvent.submit(document.querySelector('form')!)
    }

    it('renders the form and rejects mismatching passwords', () => {
        render(<RecoverPasswordFinish token="tok" />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'RecoverPassword.password')), { target: { value: 'heslo1' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'RecoverPassword.passwordConfirmation')), { target: { value: 'heslo2' } })
        fireEvent.submit(document.querySelector('form')!)

        expect(mutationCalls.length).toBe(0)
        expect(screen.getByText(translate(cs, 'RecoverPassword.passwordConfirmationError'))).toBeTruthy()
    })

    it('submits the new password with the token and redirects home', async () => {
        render(<RecoverPasswordFinish token="tok-123" />)

        fillAndSubmit()

        await waitFor(() => expect(routerPushes[0]).toEqual({ href: '/', as: '/' }))
        expect(mutationCalls[0]?.variables).toEqual({ newPassword: 'novéheslo', token: 'tok-123' })
        expect(resetStoreCalls).toBe(1)
        expect(toasts[0]?.type).toBe('success')
    })

    it('shows the error banner when the token is rejected', async () => {
        mutateResult = Promise.reject(new Error('bad token'))
        render(<RecoverPasswordFinish token="bad" />)

        fillAndSubmit()

        await waitFor(() => expect(screen.getByText(translate(cs, 'RecoverPassword.changeError'))).toBeTruthy())
    })
})

describe('useRoutes', () => {
    it('pushes through the router with href and as', () => {
        const routes = renderHook(() => useRoutes()).result.current
        routes.push(routes.homepage())
        expect(routerPushes[0]).toEqual({ href: '/', as: '/' })
    })

    it('builds detail and edit URLs', () => {
        const routes = renderHook(() => useRoutes()).result.current
        expect(routes.gameDetail('42', 'Dračí Doupě')).toEqual({
            href: '/gameDetail?id=42',
            as: '/larp/draci-doupe/cs/42',
        })
        expect(routes.eventDetail('e1', 'Festival')).toEqual({
            href: '/eventDetail?id=e1',
            as: expect.stringContaining('festival'),
        })
        expect(routes.groupDetail('g9')).toEqual({ href: '/groupDetail?id=g9', as: '/group/g9' })
        expect(routes.gameEdit('7')).toEqual({ href: '/gameEdit?id=7', as: '/gameEdit/7' })
        expect(routes.eventEdit('e2')).toEqual({ href: '/eventEdit?id=e2', as: '/eventEdit/e2' })
    })

    it('builds the catalog, profile and admin routes', () => {
        const routes = renderHook(() => useRoutes()).result.current
        expect(routes.games(LadderType.MostPlayed)).toEqual({
            href: `/games?ladderType=${LadderType.MostPlayed}`,
            as: `/games/${LadderType.MostPlayed}`,
        })
        expect(routes.currentProfile()).toEqual({ href: '/profile?id=current', as: '/profile/current' })
        expect(routes.userProfile('u5')).toEqual({ href: '/profile?id=u5', as: '/profile/u5' })
        expect(routes.userSettings()).toEqual({ href: '/profile?id=settings', as: '/profile/settings' })
        expect(routes.changePassword()).toEqual({ href: '/profile?id=changePassword', as: '/profile/changePassword' })
        expect(routes.adminUsers()).toEqual({ href: '/admin/users', as: '/admin/users' })
        expect(routes.calendar()).toEqual({ href: '/kalendar', as: '/kalendar' })
    })

    it('builds search URLs with query and type params', () => {
        const routes = renderHook(() => useRoutes()).result.current
        const withQuery = routes.search('draci larp')
        expect(withQuery.href).toBe('/search?q=draci%20larp')
        expect(routes.search('x', 'events').href).toContain('typ=')
        expect(routes.search().href).toBe('/search')
    })

    it('builds the author-filtered catalog URL', () => {
        const routes = renderHook(() => useRoutes()).result.current
        const r = routes.gamesOfAuthor('a1', 'Autor')
        expect(r.href).toBe('/games?autor=a1&autorn=Autor')
        expect(routes.gamesOfAuthor('a1').href).toBe('/games?autor=a1')
    })
})
