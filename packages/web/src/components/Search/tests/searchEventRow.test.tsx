/**
 * @jest-environment jsdom
 */
/**
 * The event row of the unified search: the pills (upcoming, away,
 * international), the location and player counts, duplicate hint, the
 * games of the event, and the registration/calendar links.
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
jest.unstable_mockModule('../../common/EventLink/EventLink', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <a href="/akce">{children}</a>,
}))
jest.unstable_mockModule('../../common/EventRegistrationLink/EventRegistrationLink', () => ({
    default: ({ url, open }: { url?: string | null; open?: boolean | null }) => (
        <a href={url ?? undefined} data-open={String(Boolean(open))}>registration</a>
    ),
}))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game }: { game: { id: string; name?: string | null } }) => <a href={`/hra/${game.id}`}>{game.name}</a>,
}))
jest.unstable_mockModule('../../common/UserLink/UserLink', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <a href="/profil">{children}</a>,
}))

let SearchEventRow: typeof import('../SearchEventRow')['SearchEventRow']

beforeAll(async () => {
    SearchEventRow = (await import('../SearchEventRow')).SearchEventRow
})

beforeEach(() => cleanup())

const futureDate = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
}

const event = {
    __typename: 'Event',
    id: 'e1',
    name: 'Festival larpů',
    from: futureDate(30),
    to: futureDate(32),
    loc: 'Praha',
    amountOfPlayers: 120,
    registrationUrl: 'https://registrace.example.test',
    registrationOpen: true,
    web: null,
    normedWeb: 'https://festival.example.test',
    labels: [{ __typename: 'Label', name: 'festival' }],
    games: [{ __typename: 'Game', id: 'g1', name: 'Hra na festivalu' }],
    addedBy: { __typename: 'User', id: 'u1', name: 'Jakub' },
}

describe('SearchEventRow', () => {
    it('renders the event name with location and player count', () => {
        render(<SearchEventRow event={event as never} query="festival" />)

        expect(screen.getAllByText((_, el) => el?.textContent === 'Festival larpů').length).toBeGreaterThan(0)
        // The location, labels and player count share one line.
        expect(screen.getAllByText((_, el) => Boolean(el?.textContent?.includes('Praha')))[0].textContent).toContain('120 hráčů')
    })

    it('marks a future event as upcoming', () => {
        render(<SearchEventRow event={event as never} query="festival" />)

        expect(screen.getByText(translate(cs, 'Search.upcomingPill'))).toBeTruthy()
    })

    it('shows the duplicate hint when several events share the row', () => {
        render(<SearchEventRow event={event as never} query="festival" duplicateCount={3} />)

        expect(screen.getByText(translate(cs, 'Search.duplicateRow', { count: 3 }))).toBeTruthy()
    })

    it('links the registration and the event games', () => {
        render(<SearchEventRow event={event as never} query="festival" />)

        expect(screen.getByText('registration').closest('a')?.getAttribute('href')).toBe('https://registrace.example.test')
        expect(screen.getAllByText((_, el) => el?.textContent === 'Hra na festivalu').length).toBeGreaterThan(0)
    })

    it('renders the bare row: no place, no players, no labels, nameless game, no web', () => {
        render(
            <SearchEventRow
                event={{ ...event, id: 'e2', loc: null, amountOfPlayers: null, labels: [], web: null, games: [{ __typename: 'Game', id: 'g2', name: null }] } as never}
                query="festival"
            />,
        )

        expect(screen.getByText(translate(cs, 'Calendar.noPlace'))).toBeTruthy()
        // A nameless game link renders as an empty text (the ?? '' arm).
        expect(screen.queryByText('Calendar.web')).toBeNull()
    })

    it('separates two linked games with a comma and shows the web action when present', () => {
        render(
            <SearchEventRow
                event={{ ...event, web: 'https://web.example.test', games: [
                    { __typename: 'Game', id: 'g1', name: 'První' },
                    { __typename: 'Game', id: 'g2', name: 'Druhá' },
                ] } as never}
                query="festival"
            />,
        )

        expect(screen.getByText('První')).toBeTruthy()
        expect(screen.getByText('Druhá')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'Calendar.web')).closest('a')?.getAttribute('href')).toBe('https://web.example.test')
    })

    it('marks a foreign and international event', () => {
        render(<SearchEventRow event={{ ...event, loc: 'Berlín, Německo', name: 'Mezinárodní festival' } as never} query="festival" />)
        expect(screen.getByText(translate(cs, 'Calendar.foreign'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'Calendar.international'))).toBeTruthy()
    })
})
