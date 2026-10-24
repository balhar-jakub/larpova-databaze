/**
 * @jest-environment jsdom
 */
/**
 * ReCaptchaField: renders the reCAPTCHA only when the backend configures a
 * key, skips validation when it does not, and shows the error after a
 * failed submit when the token is missing.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { jest } from '@jest/globals'

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let configData: { config?: { reCaptchaKey?: string | null } } | undefined
let tokenChange: ((token: string | null) => void) | undefined

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key, locale: 'cs', ready: true }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: configData, loading: false }),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('react-google-recaptcha', () => ({
    default: ({ onChange }: { onChange: (token: string | null) => void }) => {
        tokenChange = onChange
        return <div data-testid="recaptcha-widget" />
    },
}))

let ReCaptchaField: typeof import('../ReCaptchaField')['default']
let Form: typeof import('react-final-form')['Form']

beforeAll(async () => {
    ReCaptchaField = (await import('../ReCaptchaField')).default
    Form = (await import('react-final-form')).Form
})

beforeEach(() => {
    cleanup()
    configData = undefined
    tokenChange = undefined
})

const renderInForm = () =>
    render(
        <Form onSubmit={() => undefined}>
            {({ handleSubmit }) => (
                <form onSubmit={handleSubmit}>
                    <ReCaptchaField name="recaptcha" />
                    <button type="submit">submit</button>
                </form>
            )}
        </Form>,
    )

describe('ReCaptchaField', () => {
    it('renders nothing interactive when no key is configured', () => {
        configData = { config: { reCaptchaKey: null } }
        renderInForm()

        expect(screen.queryByTestId('recaptcha-widget')).toBeNull()
    })

    it('renders the widget when the key is configured and accepts the token', () => {
        configData = { config: { reCaptchaKey: 'site-key' } }
        renderInForm()

        expect(screen.getByTestId('recaptcha-widget')).toBeTruthy()
        act(() => tokenChange?.('the-token'))
    })

    it('shows the validation error after a failed submit without a token', async () => {
        configData = { config: { reCaptchaKey: 'site-key' } }
        renderInForm()

        fireEvent.submit(screen.getByText('submit'))
        expect(await screen.findByText('ReCaptchaField.required')).toBeTruthy()
    })

    it('stays valid when the key is absent even after a failed submit', () => {
        configData = { config: { reCaptchaKey: null } }
        renderInForm()

        fireEvent.submit(screen.getByText('submit'))
        expect(screen.queryByText('ReCaptchaField.required')).toBeNull()
    })
})
