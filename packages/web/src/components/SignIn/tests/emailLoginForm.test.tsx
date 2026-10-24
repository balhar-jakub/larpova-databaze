/**
 * @jest-environment jsdom
 */
/**
 * The email magic-link login form: submits the trimmed email with the login
 * URL template, shows the sent confirmation, and validates the email.
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

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        mutationCalls.push(opts)
        return Promise.resolve({ data: { user: { startEmailLogin: true } } })
    }, { loading: false, error: undefined }],
}))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({ useFocusInput: () => ({ current: null }) }))

let EmailLoginForm: typeof import('../EmailLoginForm')['EmailLoginForm']

beforeAll(async () => {
    EmailLoginForm = (await import('../EmailLoginForm')).EmailLoginForm
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
})

const submit = () => fireEvent.submit(document.querySelector('form')!)

describe('EmailLoginForm', () => {
    it('sends the trimmed email with the magic-link URL template', async () => {
        render(<EmailLoginForm />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'SignIn.emailPlaceholder')), { target: { value: '  jakub@example.test  ' } })
        submit()

        await waitFor(() => expect(mutationCalls.length).toBe(1))
        expect(mutationCalls[0]?.variables).toEqual({
            email: 'jakub@example.test',
            loginUrlTemplate: 'http://localhost/auth/email-login?token={token}',
        })
    })

    it('confirms the magic link was sent', async () => {
        render(<EmailLoginForm />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'SignIn.emailPlaceholder')), { target: { value: 'jakub@example.test' } })
        submit()

        await waitFor(() =>
            expect(
                screen.getAllByText((_, el) => Boolean(el?.textContent?.includes(translate(cs, 'SignIn.magicLinkSent', { email: 'jakub@example.test' })))).length,
            ).toBeGreaterThan(0),
        )
    })

    it('rejects an invalid email without calling the mutation', () => {
        render(<EmailLoginForm />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'SignIn.emailPlaceholder')), { target: { value: 'neplatny' } })
        submit()

        expect(mutationCalls.length).toBe(0)
        expect(screen.getAllByText(translate(cs, 'Errors.emailRequired')).length).toBeGreaterThan(0)
    })

    it('rejects an empty email', () => {
        render(<EmailLoginForm />)

        submit()

        expect(mutationCalls.length).toBe(0)
        expect(screen.getAllByText(translate(cs, 'Errors.required')).length).toBeGreaterThan(0)
    })
})
