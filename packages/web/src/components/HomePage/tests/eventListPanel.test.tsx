/**
 * @jest-environment jsdom
 */
/**
 * The event list panel: renders the header when asked and every event
 * with its date range (one-day events collapse to a single date) and
 * the future marker.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

// The event link renders an anchor to the event page.
jest.unstable_mockModule('../../common/EventLink/EventLink', () => ({
    default: ({ event, children }: { event: { id: string }; children: React.ReactNode }) => (
        <a href={`/eventDetail?id=${event.id}`}>{children}</a>
    ),
}))

let EventListPanel: typeof import('../EventListPanel').EventListPanel

beforeAll(async () => {
    EventListPanel = (await import('../EventListPanel')).EventListPanel
})

beforeEach(() => cleanup())

const event = (over: Record<string, unknown> = {}) => ({
    id: 'e1',
    name: 'Festival larpů',
    from: '2026-05-01T10:00:00.000Z',
    to: '2026-05-03T18:00:00.000Z',
    ...over,
})

describe('EventListPanel', () => {
    it('renders the header only when a title key is given', () => {
        render(<EventListPanel events={[]} titleKey="GameDetail.events" />)

        expect(screen.getByText(translate(cs, 'GameDetail.events'))).toBeTruthy()

        cleanup()
        render(<EventListPanel events={[]} />)

        expect(screen.queryByText(translate(cs, 'GameDetail.events'))).toBeNull()
    })

    it('lists every event with its date range', () => {
        render(
            <EventListPanel
                events={[event(), event({ id: 'e2', name: 'Jarní hra' })]}
                titleKey="GameDetail.events"
            />,
        )

        // The range keeps both ends: "from - to" inside the parentheses.
        expect(screen.getByText(/Festival larpů/).textContent).toContain(' - ')
        expect(screen.getByText(/Jarní hra/)).toBeTruthy()
        expect(screen.getAllByRole('link').length).toBe(2)
    })

    it('collapses a one-day event to a single date', () => {
        // Date-only values (no time part) format as plain dates.
        render(
            <EventListPanel
                events={[event({ from: '2026-05-01', to: '2026-05-01' })]}
            />,
        )

        const text = screen.getByText(/Festival larpů/).textContent ?? ''
        expect(text).not.toContain(' - ')
        expect(text).toContain('1.5.2026')
    })
})
