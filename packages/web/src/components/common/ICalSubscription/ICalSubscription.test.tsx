/**
 * @jest-environment jsdom
 */
/**
 * ICalSubscription: the /ical affordance shared by the calendar page and the
 * event detail page. It renders the native subscription link plus — once the
 * absolute URL is known (client-side only) — the full URL and a
 * copy-to-clipboard button that fires the success toast.
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

const toasts: Array<{ text: string; type?: string }> = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('../../../hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type?: string) => { toasts.push({ text, type }) },
}))

let ICalSubscription: typeof import('./ICalSubscription').default
let componentTestIds: typeof import('../../componentTestIds').componentTestIds

beforeAll(async () => {
    ICalSubscription = (await import('./ICalSubscription')).default
    componentTestIds = (await import('../../componentTestIds')).componentTestIds
})

beforeEach(() => {
    cleanup()
    toasts.length = 0
})

describe('ICalSubscription', () => {
    it('renders the native /ical link with the subscription copy', async () => {
        render(<ICalSubscription />)

        const link = screen.getByTestId(componentTestIds.icalSubscription.link)
        expect(link.getAttribute('href')).toBe('/ical')
        expect(link.getAttribute('target')).toBe('_blank')
        expect(link.getAttribute('rel')).toBe('noreferrer')
        expect(link.textContent).toBe(translate(cs, 'ICal.subscribe'))
    })

    it('shows the absolute URL and a copy button once mounted, and copies on click', async () => {
        const writeText = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

        render(<ICalSubscription />)
        await waitFor(() => expect(screen.getByTestId(componentTestIds.icalSubscription.copy)).toBeTruthy())

        const expectedUrl = `${window.location.protocol}//${window.location.host}/ical`
        expect(screen.getByTestId(componentTestIds.icalSubscription.wrapper).getAttribute('data-url')).toBe(expectedUrl)
        expect(screen.getByText(expectedUrl)).toBeTruthy()

        fireEvent.click(screen.getByTestId(componentTestIds.icalSubscription.copy))
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(expectedUrl))
        await waitFor(() => expect(toasts).toEqual([{ text: translate(cs, 'ICal.copied'), type: 'success' }]))
    })

    it('keeps the URL visible when the clipboard API is unavailable', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: () => Promise.reject(new Error('denied')) },
            configurable: true,
        })

        render(<ICalSubscription />)
        await waitFor(() => expect(screen.getByTestId(componentTestIds.icalSubscription.copy)).toBeTruthy())

        const expectedUrl = `${window.location.protocol}//${window.location.host}/ical`
        fireEvent.click(screen.getByTestId(componentTestIds.icalSubscription.copy))
        await waitFor(() => expect(screen.getByText(expectedUrl)).toBeTruthy())
        // No success toast on failure, but nothing is lost: the URL stays rendered.
        expect(toasts).toEqual([])
    })

    it('appends the query to both the link href and the copied URL', async () => {
        const writeText = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

        render(<ICalSubscription query="?id=u1" />)
        await waitFor(() => expect(screen.getByTestId(componentTestIds.icalSubscription.copy)).toBeTruthy())

        expect(screen.getByTestId(componentTestIds.icalSubscription.link).getAttribute('href')).toBe('/ical?id=u1')
        const expectedUrl = `${window.location.protocol}//${window.location.host}/ical?id=u1`
        expect(screen.getByTestId(componentTestIds.icalSubscription.wrapper).getAttribute('data-url')).toBe(expectedUrl)

        fireEvent.click(screen.getByTestId(componentTestIds.icalSubscription.copy))
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(expectedUrl))
    })
})
