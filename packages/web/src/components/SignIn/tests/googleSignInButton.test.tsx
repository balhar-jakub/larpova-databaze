/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The Google button is the only part of the feature a visitor sees, and it has one
 * job that matters: never be a dead link. It asks the server whether the OAuth
 * client is configured and only then renders, and it surfaces the reasons the
 * callback can refuse a sign-in.
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

let query: Record<string, string> = {}

jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ query, push: () => undefined, asPath: '/signIn' }),
}))

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

let GoogleSignInButton: typeof import('../GoogleSignInButton').GoogleSignInButton

beforeAll(async () => {
    GoogleSignInButton = (await import('../GoogleSignInButton')).GoogleSignInButton
})

const originalFetch = global.fetch

beforeEach(() => {
    query = {}
    window.history.pushState({}, '', '/')
})

afterEach(() => {
    global.fetch = originalFetch
})

function status(enabled: boolean) {
    const mock = jest.fn(async () => ({ ok: true, json: async () => ({ enabled }) }))
    global.fetch = mock as unknown as typeof fetch
    return mock
}

describe('GoogleSignInButton', () => {
    it('renders nothing at all when the server has no OAuth client', async () => {
        const fetchMock = status(false)
        const { container, queryByRole } = render(<GoogleSignInButton />)

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(queryByRole('link')).toBeNull()
        // No jest-dom matchers in this repo; an empty container is the assertion.
        expect(container.innerHTML).toBe('')
    })

    it('offers a plain link back into the flow when it is configured', async () => {
        status(true)
        render(<GoogleSignInButton />)

        const link = await screen.findByRole('link')
        expect(link.textContent).toBe(cs.SignIn.googleSignIn)
        expect(link.getAttribute('href')).toBe(`/auth/google?returnTo=${encodeURIComponent('/')}`)
    })

    // A user who signs in from an auth page must land on the homepage, not be
    // bounced back to the sign-in form — the email form and magic-link flows
    // already behave that way.
    it.each(['/signIn', '/signUp', '/recoverPassword'])(
        'sends a sign-in started on %s back to the homepage',
        async (pathname) => {
            window.history.pushState({}, '', pathname)
            status(true)
            render(<GoogleSignInButton />)

            const link = await screen.findByRole('link')
            expect(link.getAttribute('href')).toBe(`/auth/google?returnTo=${encodeURIComponent('/')}`)
        },
    )

    it('keeps the current page for an in-place sign-in (rating, comment)', async () => {
        window.history.pushState({}, '', '/gameDetail?id=42')
        status(true)
        render(<GoogleSignInButton />)

        const link = await screen.findByRole('link')
        expect(link.getAttribute('href')).toBe(
            `/auth/google?returnTo=${encodeURIComponent('/gameDetail?id=42')}`,
        )
    })

    it('shows the divider only when there is a button above it', async () => {
        status(true)
        render(<GoogleSignInButton showDivider />)

        expect(await screen.findByText(cs.SignIn.googleOrEmail)).toBeTruthy()
    })

    it('explains a refused or failed sign-in', async () => {
        status(false)
        query = { error: 'google_ambiguous' }
        render(<GoogleSignInButton showDivider />)

        expect(await screen.findByText(cs.SignIn.googleError.google_ambiguous)).toBeTruthy()
    })

    it('ignores error codes that are not its own', async () => {
        const fetchMock = status(false)
        query = { error: 'expired_token' }
        const { container } = render(<GoogleSignInButton />)

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(container.innerHTML).toBe('')
    })

    it('stays quiet when the status request fails', async () => {
        const failing = jest.fn(async () => {
            throw new Error('network down')
        })
        global.fetch = failing as unknown as typeof fetch
        const { container } = render(<GoogleSignInButton />)

        await waitFor(() => expect(failing).toHaveBeenCalled())
        expect(container.innerHTML).toBe('')
    })

    // SSR, in a separate file with @jest-environment node (jsdom's global IS
    // the Window — window.window === window, non-configurable getter — so the
    // `typeof window === 'undefined'` arm cannot be driven from jsdom at all;
    // a plain globalThis.window = undefined bounces off the getter silently).
    // See googleSignInButtonSSR.test.tsx.
})
