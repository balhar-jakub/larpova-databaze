import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ({
                'Event.registrationLink': 'Přihlášení',
                'Event.registrationOpen': 'Přihlašování otevřeno',
                'EventCalendar.link': 'Web akce',
            })[key] ?? key,
    }),
}))

jest.unstable_mockModule('../common/EventLink/EventLink', () => ({
    default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <a className={className}>{children}</a>
    ),
}))

jest.unstable_mockModule('../../utils/dateUtils', () => ({
    formatTimeRange: () => ({ fromFormatted: '1.10.2026', toFormatted: '1.10.2026', justOneDate: true }),
}))

let CalendarEventPanel: typeof import('./CalendarEventPanel').default

beforeAll(async () => {
    CalendarEventPanel = (await import('./CalendarEventPanel')).default
})

const event = {
    id: '1',
    name: 'Test event',
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-01T00:00:00.000Z',
    web: 'https://example.test',
    registrationUrl: 'https://example.test/signup',
    registrationOpen: true,
    loc: 'Praha',
    labels: [],
}

describe('CalendarEventPanel registration status', () => {
    it('highlights an event with open registration', () => {
        const { container } = render(<CalendarEventPanel event={event} />)

        expect(screen.getByRole('link', { name: 'Přihlašování otevřeno' })).toBeTruthy()
        expect(container.firstElementChild?.className).toContain('registrationOpen')
    })

    it('keeps a closed registration event neutral', () => {
        const { container } = render(<CalendarEventPanel event={{ ...event, registrationOpen: false }} />)

        expect(screen.getByRole('link', { name: 'Přihlášení' })).toBeTruthy()
        expect(container.firstElementChild?.className).not.toContain('registrationOpen')
    })

    it('does not highlight an invalid legacy registration URL', () => {
        const { container } = render(
            <CalendarEventPanel event={{ ...event, registrationUrl: 'javascript:alert(1)', registrationOpen: true }} />,
        )

        expect(screen.queryByRole('link', { name: 'Přihlašování otevřeno' })).toBeNull()
        expect(container.firstElementChild?.className).not.toContain('registrationOpen')
    })

    it('keeps the event website separate from registration', () => {
        render(<CalendarEventPanel event={event} />)

        expect(screen.getByRole('link', { name: 'Web akce' }).getAttribute('href')).toBe('https://example.test')
        expect(screen.getByRole('link', { name: 'Přihlašování otevřeno' }).getAttribute('href')).toBe(
            'https://example.test/signup',
        )
    })
})
