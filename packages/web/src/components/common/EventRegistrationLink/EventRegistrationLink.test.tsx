import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ({
                'Event.registrationLink': 'Přihlášení',
                'Event.registrationOpen': 'Přihlašování otevřeno',
                'Event.registrationClosed': 'Registrace uzavřená',
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
})
