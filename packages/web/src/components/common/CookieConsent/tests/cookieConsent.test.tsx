/**
 * @jest-environment jsdom
 */
/**
 * The cookie consent banner: hidden until a decision is pending, accept
 * and reject store the decision and hide the banner, and a stored
 * decision replays into gtag without showing the banner again.
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

const stored: Array<{ granted: boolean }> = []
const updated: Array<{ granted: boolean }> = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('src/utils/gtag', () => ({
    GA_ENABLED: true,
    GA_CONSENT_KEY: 'ga-consent',
    storeGTagConsent: (granted: boolean) => {
        stored.push({ granted })
        window.localStorage.setItem('ga-consent', granted ? 'granted' : 'denied')
    },
    updateGTagConsent: (granted: boolean) => { updated.push({ granted }) },
}))

let CookieConsent: typeof import('../CookieConsent')['CookieConsent']

beforeAll(async () => {
    CookieConsent = (await import('../CookieConsent')).CookieConsent
})

beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    stored.length = 0
    updated.length = 0
})

describe('CookieConsent', () => {
    it('shows the banner when no decision is stored', async () => {
        render(<CookieConsent />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getByTestId('cookieConsent')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'Cookies.text'))).toBeTruthy()
    })

    it('accept stores granted, updates gtag and hides the banner', async () => {
        render(<CookieConsent />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        fireEvent.click(screen.getByText(translate(cs, 'Cookies.accept')))
        expect(stored).toEqual([{ granted: true }])
        expect(updated).toEqual([{ granted: true }])
        expect(screen.queryByTestId('cookieConsent')).toBeNull()
        expect(window.localStorage.getItem('ga-consent')).toBe('granted')
    })

    it('reject stores denied and hides the banner', async () => {
        render(<CookieConsent />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        fireEvent.click(screen.getByText(translate(cs, 'Cookies.reject')))
        expect(stored).toEqual([{ granted: false }])
        expect(window.localStorage.getItem('ga-consent')).toBe('denied')
        expect(screen.queryByTestId('cookieConsent')).toBeNull()
    })

    it('does not show the banner when a decision is already stored', async () => {
        window.localStorage.setItem('ga-consent', 'denied')
        render(<CookieConsent />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.queryByTestId('cookieConsent')).toBeNull()
        // The stored decision replays into gtag.
        expect(updated).toEqual([{ granted: false }])
    })
})
