/**
 * @jest-environment jsdom
 */
/**
 * The recover-password start page: email form with validation, the sent
 * confirmation on success, the error banner on failure, and the mutation
 * variables (email + recover URL template).
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
let mutateResult: Promise<{ data?: unknown }> = Promise.resolve({ data: {} })

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
    }),
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: () => undefined, pathname: '/', query: {} }),
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        recoverPasswordStart: () => ({ href: '/recoverPassword', as: '/obnova-hesla' }),
        push: () => undefined,
    }),
}))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({ useFocusInput: () => ({ current: null }) }))
jest.unstable_mockModule('../../common/FormPageRow/FormPageRow', () => ({
    default: ({ children, headerText }: { children: React.ReactNode; headerText?: string }) => (
        <div><h1>{headerText}</h1>{children}</div>
    ),
}))
jest.unstable_mockModule('../../common/SubmitButton/SubmitButton', () => ({
    default: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}))

let RecoverPasswordStart: typeof import('../RecoverPasswordStart')['default']

beforeAll(async () => {
    RecoverPasswordStart = (await import('../RecoverPasswordStart')).default
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    mutateResult = Promise.resolve({ data: {} })
})

describe('RecoverPasswordStart', () => {
    it('renders the email form', () => {
        render(<RecoverPasswordStart />)
        expect(screen.getByPlaceholderText(translate(cs, 'RecoverPassword.email'))).toBeTruthy()
    })

    it('rejects an invalid email without calling the mutation', () => {
        render(<RecoverPasswordStart />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'RecoverPassword.email')), { target: { value: 'neplatny' } })
        fireEvent.submit(document.querySelector('form')!)

        expect(mutationCalls.length).toBe(0)
        expect(screen.getAllByText(translate(cs, 'Errors.emailRequired')).length).toBeGreaterThan(0)
    })

    it('sends the recovery email and shows the sent confirmation', async () => {
        mutateResult = Promise.resolve({ data: { user: { startRecoverPassword: true } } })
        render(<RecoverPasswordStart />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'RecoverPassword.email')), { target: { value: 'jakub@example.test' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(screen.getByText(translate(cs, 'RecoverPassword.sent'))).toBeTruthy())
        const vars = mutationCalls[0]?.variables as { email?: string; recoverUrl?: string } | undefined
        expect(vars?.email).toBe('jakub@example.test')
        expect(vars?.recoverUrl).toContain('token={token}')
    })

    it('shows the error banner when the email is unknown', async () => {
        mutateResult = Promise.resolve({ data: { user: { startRecoverPassword: false } } })
        render(<RecoverPasswordStart />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'RecoverPassword.email')), { target: { value: 'neznamy@example.test' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(screen.getByText(translate(cs, 'RecoverPassword.error'))).toBeTruthy())
    })
})
