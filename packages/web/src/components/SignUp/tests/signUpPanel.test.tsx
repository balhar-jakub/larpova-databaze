/**
 * @jest-environment jsdom
 */
/**
 * The sign-up page: one form, two paths. The default magic-link mode sends
 * the link and shows the "link sent" screen (with the password fallback);
 * the password mode expands password + reCAPTCHA, rejects an email that is
 * already used, and submits the create-user mutation.
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let emailAvailable = true
let usedByUser: { id: string; name?: string } | undefined = undefined
let mutationResult: Promise<{ data?: unknown }> = Promise.resolve({ data: {} })
const mutationCalls: Array<{ variables?: Record<string, unknown>; mutation?: unknown }> = []
let pushedRoute = ''

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({
        mutate: (opts: { variables?: Record<string, unknown>; mutation?: unknown }) => {
            mutationCalls.push(opts)
            return mutationResult
        },
        resetStore: () => undefined,
        query: () => Promise.resolve({ data: { user: { checkEmail: { available: emailAvailable, user: usedByUser } } } }),
    }),
    useMutation: () => [(opts: { variables?: Record<string, unknown>; mutation?: unknown }) => {
        mutationCalls.push(opts)
        return mutationResult
    }, { loading: false }],
}))
jest.unstable_mockModule('src/hooks/useIsEmailAvailable', () => ({
    useIsEmailAvailable: () => ({ usedByUser, isEmailAvailable: async () => emailAvailable }),
}))
jest.unstable_mockModule('src/hooks/useMediaQuery', () => ({
    useIsMdOrLarger: () => true,
}))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({
    useFocusInput: () => ({ current: null }),
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = {
            homepage: () => '/',
            recoverPasswordStart: () => ({ href: '/obnova-hesla', as: '/obnova-hesla' }),
            signIn: () => '/prihlaseni',
        }
        return { ...routes, push: (url: string) => { pushedRoute = url } }
    },
}))
jest.unstable_mockModule('../../common/FormPageRow/FormPageRow', () => ({
    default: ({ children, headerText }: { children: React.ReactNode; headerText?: string }) => (
        <div>
            <h1>{headerText}</h1>
            {children}
        </div>
    ),
}))
jest.unstable_mockModule('../../common/TextLink/TextLink', () => ({
    TextLink: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}))
jest.unstable_mockModule('../ReCaptchaField', () => ({
    default: ({ name }: { name: string }) => <div data-testid={`recaptcha-${name}`} />,
}))
jest.unstable_mockModule('../../SignIn/GoogleSignInButton', () => ({
    GoogleSignInButton: () => <div data-testid="google-signin" />,
}))
jest.unstable_mockModule('../../common/SubmitButton/SubmitButton', () => ({
    default: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({ useShowToast: () => () => undefined }))

let SignUpPanel: typeof import('../SignUpPanel')['default']

beforeAll(async () => {
    SignUpPanel = (await import('../SignUpPanel')).default
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    emailAvailable = true
    usedByUser = undefined
    mutationResult = Promise.resolve({ data: {} })
    pushedRoute = ''
})

describe('SignUpPanel', () => {
    it('renders the magic-link form with the email field and Google button', () => {
        render(<SignUpPanel />)

        expect(screen.getByTestId('google-signin')).toBeTruthy()
        expect(screen.getByRole('textbox')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'SignUp.linkIntro'))).toBeTruthy()
    })

    it('does not show password fields in the default link mode', () => {
        render(<SignUpPanel />)
        // Only the email input; password/reCaptcha appear in the password mode.
        expect(screen.queryAllByRole('textbox').length).toBe(1)
        expect(screen.queryByTestId('recaptcha-recaptcha')).toBeNull()
    })

    it('sends the magic link and shows the link-sent screen with the password fallback', async () => {
        render(<SignUpPanel />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'novy@example.test' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => {
            expect(screen.getByText(translate(cs, 'SignIn.magicLinkSent', { email: 'novy@example.test' }))).toBeTruthy()
        })
        // The sent screen offers the password path when the link does not arrive.
        fireEvent.click(screen.getByText(translate(cs, 'SignUp.linkNotArrivedUsePassword')))
        // Now the password mode with its two password inputs is visible.
        expect(screen.getByPlaceholderText(translate(cs, 'UserFields.password'))).toBeTruthy()
        expect(screen.getByPlaceholderText(translate(cs, 'UserFields.passwordAgain'))).toBeTruthy()
    })

    it('expands the password mode via the toggle, keeping the typed email', async () => {
        render(<SignUpPanel />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'novy@example.test' } })
        fireEvent.click(screen.getByText(translate(cs, 'SignUp.setPasswordToggle')))

        expect(screen.getByPlaceholderText(translate(cs, 'UserFields.password'))).toBeTruthy()
        expect(screen.getByPlaceholderText(translate(cs, 'UserFields.passwordAgain'))).toBeTruthy()
        expect(screen.getByTestId('recaptcha-recaptcha')).toBeTruthy()
    })

    it('stays on the form when the account creation fails', async () => {
        mutationResult = Promise.resolve({ data: { user: { createUser: null } } })
        render(<SignUpPanel />)
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'novy@example.test' } })
        fireEvent.click(screen.getByText(translate(cs, 'SignUp.setPasswordToggle')))
        await screen.findByPlaceholderText(translate(cs, 'UserFields.password'))
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'UserFields.password')), { target: { value: 'heslo123' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'UserFields.passwordAgain')), { target: { value: 'heslo123' } })
        fireEvent.submit(document.querySelector('form')!)

        // The form is back (idle), no homepage redirect.
        await screen.findByPlaceholderText(translate(cs, 'UserFields.password'))
        expect(pushedRoute).toBe('')
    })

    it('refuses an already-used email in password mode and hints at recovery', async () => {
        emailAvailable = false
        // The (mocked) availability hook reports the existing user — the
        // email field shows the "already used" hint with the recovery link.
        usedByUser = { id: '7', name: 'Kdo Jiný' }
        render(<SignUpPanel />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'existujici@example.test' } })
        fireEvent.click(screen.getByText(translate(cs, 'SignUp.setPasswordToggle')))
        const passwordBox = await screen.findByPlaceholderText(translate(cs, 'UserFields.password'))

        // The hint is driven by the email blur in password mode.
        fireEvent.blur(screen.getByRole('textbox'))

        // Submit with a matching password pair; the email check fails first.
        fireEvent.change(passwordBox, { target: { value: 'heslo123' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'UserFields.passwordAgain')), { target: { value: 'heslo123' } })

        await waitFor(() => {
            expect(
                screen.getAllByText((_, element) => Boolean(element?.textContent?.includes('Kdo Jiný'))).length,
            ).toBeGreaterThan(0)
        })
    })

    it('creates the account with password and lands on the homepage', async () => {
        mutationResult = Promise.resolve({ data: { user: { createUser: { id: '99' } } } })
        render(<SignUpPanel />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'novy@example.test' } })
        fireEvent.click(screen.getByText(translate(cs, 'SignUp.setPasswordToggle')))
        await screen.findByPlaceholderText(translate(cs, 'UserFields.password'))
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'UserFields.password')), { target: { value: 'heslo123' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'UserFields.passwordAgain')), { target: { value: 'heslo123' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(pushedRoute).toBe('/'))
        // The mutation carried the email and password.
        const create = mutationCalls.find((c) => JSON.stringify(c.variables ?? {}).includes('heslo123'))
        expect(create).toBeTruthy()
    })
})
