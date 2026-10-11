import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { date?: string }) =>
            ({
                'Event.registrationLink': 'Přihlášení',
                'Event.registrationOpen': 'Přihlašování otevřeno',
                'Event.registrationClosed': 'Registrace uzavřená',
                'Event.registrationUpcoming': 'Přihlašování se teprve otevře',
                'Event.registrationOpensOn': `Přihlašování se otevře ${options?.date ?? ''}`,
                'Event.registrationOrganizerForm': 'formulář pořadatele',
            })[key] ?? key,
    }),
}))

let EventRegistrationLink: typeof import('./EventRegistrationLink').default

beforeAll(async () => {
    EventRegistrationLink = (await import('./EventRegistrationLink')).default
})

describe('EventRegistrationLink', () => {
    it('renders nothing without a URL', () => {
        const { container } = render(<EventRegistrationLink url={null} open={false} />)
        expect(container.childElementCount).toBe(0)
    })

    it('renders nothing for a non-HTTP URL', () => {
        const { container } = render(<EventRegistrationLink url="javascript:alert(1)" open />)
        expect(container.childElementCount).toBe(0)
    })

    it('renders a closed badge and organizer form link when registration is closed', () => {
        render(<EventRegistrationLink url="https://example.test/signup" open={false} />)

        const badge = screen.getByText('Registrace uzavřená')
        expect(badge).toBeTruthy()
        expect(badge.getAttribute('href')).toBe(null)

        const formLink = screen.getByRole('link', { name: 'formulář pořadatele' })
        expect(formLink.getAttribute('href')).toBe('https://example.test/signup')
        expect(formLink.getAttribute('target')).toBe('_blank')
        expect(formLink.getAttribute('rel')).toBe('noreferrer')
    })

    it('renders an emphasized registration link when registration is open', () => {
        render(<EventRegistrationLink url="https://example.test/signup" open />)

        const link = screen.getByRole('link', { name: 'Přihlašování otevřeno' })
        expect(link.getAttribute('href')).toBe('https://example.test/signup')
        expect(link.getAttribute('target')).toBe('_blank')
        expect(link.getAttribute('rel')).toBe('noreferrer')
        expect(link.className).toContain('open')
    })

    it('renders an upcoming badge and keeps the organizer form link when registration has not opened yet', () => {
        render(<EventRegistrationLink url="https://example.test/signup" open={false} status="UPCOMING" />)

        const badge = screen.getByText('Přihlašování se teprve otevře')
        expect(badge.getAttribute('href')).toBe(null)
        const formLink = screen.getByRole('link', { name: 'formulář pořadatele' })
        expect(formLink.getAttribute('href')).toBe('https://example.test/signup')

        expect(screen.queryByText('Registrace uzavřená')).toBe(null)
    })

    it('renders the opens-on date when the upcoming registration has a date', () => {
        render(
            <EventRegistrationLink
                url="https://example.test/signup"
                open={false}
                status="UPCOMING"
                opensAt="2026-11-15T10:00:00.000Z"
            />,
        )

        const badge = screen.getByText('Přihlašování se otevře 15. 11. 2026')
        expect(badge).toBeTruthy()
    })

    it('falls back to the upcoming badge for an unparseable opens-at value', () => {
        render(
            <EventRegistrationLink
                url="https://example.test/signup"
                open={false}
                status="UPCOMING"
                opensAt="not a date"
            />,
        )

        expect(screen.getByText('Přihlašování se teprve otevře')).toBeTruthy()
    })

    it('renders the closed badge when the status is CLOSED even with a stale opens-at value', () => {
        render(
            <EventRegistrationLink
                url="https://example.test/signup"
                open={false}
                status="CLOSED"
                opensAt="2026-11-15T10:00:00.000Z"
            />,
        )

        expect(screen.getByText('Registrace uzavřená')).toBeTruthy()
    })
})
