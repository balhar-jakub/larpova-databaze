/**
 * @jest-environment node
 *
 * The SSR arm of GoogleSignInButton — `typeof window === 'undefined' ? '/' :
 * window.location.pathname` — cannot be driven from the jsdom suite: jsdom's
 * global IS the Window (window.window === window, behind a non-configurable
 * getter), so `globalThis.window = undefined` bounces off it silently and the
 * arm stays cold. This file runs in the plain node environment, where the
 * property genuinely does not exist.
 *
 * The only SSR shape that reaches the ternary is the ERROR render: the early
 * return (`if (!enabled && !errorKey) return null`) skips the whole body when
 * there is nothing to show, but a callback error (?error=google_*) renders
 * the message on the very first render — that render must not crash without
 * `window`.
 */
import React from 'react'
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

jest.unstable_mockModule('next/router', () => ({
    // A callback error arrives as /signIn?error=… — the query the SSR render sees.
    useRouter: () => ({ query: { error: 'google_ambiguous' }, push: () => undefined, asPath: '/signIn' }),
}))

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

let GoogleSignInButton: typeof import('../GoogleSignInButton').GoogleSignInButton
const originalFetch = global.fetch

beforeAll(async () => {
    GoogleSignInButton = (await import('../GoogleSignInButton')).GoogleSignInButton
})

afterAll(() => {
    global.fetch = originalFetch
})

describe('GoogleSignInButton on the server', () => {
    it('renders a callback error without window: no crash, returnTo falls back to /', () => {
        expect(typeof window).toBe('undefined')
        expect(typeof (globalThis as Record<string, unknown>).window).toBe('undefined')

        // The error key passes the early-return gate, so the component body —
        // including the pathname ternary's SSR arm — executes on this render.
        const markup = renderToStaticMarkup(<GoogleSignInButton />)

        // The error message is rendered; the button is not (enabled stays
        // false — no effects under renderToStaticMarkup), so the markup
        // carries the message and no anchor.
        expect(markup).toContain(cs.SignIn.googleError.google_ambiguous)
        expect(markup).not.toContain('href')
    })
})
