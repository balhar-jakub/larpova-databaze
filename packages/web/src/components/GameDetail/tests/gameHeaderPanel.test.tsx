/**
 * @jest-environment jsdom
 */
/**
 * The game header: name, players/time facts, web and gallery links,
 * photo author, description (sanitized), authors and groups links,
 * labels — and the placeholder layout when no description exists.
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

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('../../common/UserLink/UserLink', () => ({
    default: ({ userId, children }: { userId: string; children?: React.ReactNode }) => (
        <a href={`/profil/${userId}`}>{children ?? userId}</a>
    ),
}))
jest.unstable_mockModule('../../common/GroupLink/GroupLink', () => ({
    default: ({ groupId, children }: { groupId: string; children?: React.ReactNode }) => (
        <a href={`/skupina/${groupId}`}>{children ?? groupId}</a>
    ),
}))
jest.unstable_mockModule('../../common/DetailLabelList/DetailLabelList', () => ({
    default: ({ labels }: { labels: Array<{ id: string; name?: string | null }> }) => (
        <div data-testid="label-list">{labels.map((l) => l.name).join(', ')}</div>
    ),
}))

let GameHeaderPanel: typeof import('../GameHeaderPanel')['GameHeaderPanel']

beforeAll(async () => {
    GameHeaderPanel = (await import('../GameHeaderPanel')).GameHeaderPanel
})

const baseGame = {
    __typename: 'Game',
    id: 'g1',
    name: 'Dračí doupě',
    players: 30,
    menRole: 10,
    womenRole: 15,
    bothRole: 5,
    year: 2026,
    lengthInHours: 48,
    days: 2,
    web: 'https://example.test',
    galleryURL: 'https://gallery.example.test',
    photoAuthor: 'Foto AUTOR',
    description: '<p>Legendární hra</p>',
    labels: [{ __typename: 'Label', id: 'l1', name: 'dungeon' }],
    authors: [{ __typename: 'User', id: 'u1', name: 'Autor Jeden' }],
    groupAuthor: [{ __typename: 'Group', id: 'gr1', name: 'Skupina XY' }],
}

const renderPanel = (over: Record<string, unknown> = {}) =>
    render(<GameHeaderPanel game={{ ...baseGame, ...over } as never} />)

beforeEach(() => cleanup())

describe('GameHeaderPanel', () => {
    it('renders the name and the players facts with counts', () => {
        renderPanel()
        expect(screen.getByText('Dračí doupě')).toBeTruthy()
        // players 30, men 10, women 15, both 5 in one facts line
        const facts = screen.getAllByText((_, el) => Boolean(el?.textContent?.includes('30')))
        expect(facts.some((f) => f.textContent?.includes('10'))).toBe(true)
    })

    it('links the web and gallery and names the photo author', () => {
        renderPanel()
        expect(screen.getByText('https://example.test').getAttribute('href')).toBe('https://example.test')
        expect(screen.getByText('https://gallery.example.test').getAttribute('href')).toBe('https://gallery.example.test')
        expect(screen.getAllByText((_, el) => Boolean(el?.textContent?.includes('Foto AUTOR')))).toBeTruthy()
    })

    it('renders the sanitized description and the labels', async () => {
        renderPanel()
        // sanitizeHtml runs in an effect.
        await new Promise((r) => setTimeout(r, 10))
        expect(document.body.innerHTML).toContain('Legendární hra')
        expect(screen.getByTestId('label-list').textContent).toBe('dungeon')
    })

    it('links the authors and groups', () => {
        renderPanel()
        expect(screen.getAllByText((_, el) => Boolean(el?.textContent?.includes(translate(cs, 'Game.authors'))))).toBeTruthy()
        expect(document.querySelector('a[href="/profil/u1"]')).toBeTruthy()
        expect(document.querySelector('a[href="/skupina/gr1"]')).toBeTruthy()
    })

    it('shows a dash when the game has no group', () => {
        renderPanel({ groupAuthor: [] })
        expect(screen.getByText('—')).toBeTruthy()
    })

    it('renders placeholders when no description exists', () => {
        renderPanel({ description: undefined })
        expect(screen.queryByTestId('label-list')).toBeNull()
        expect(screen.getByText('Dračí doupě')).toBeTruthy()
    })

    it('renders a nameless game as the placeholder and separates two authors by comma', () => {
        const { container } = renderPanel({ name: null })
        // No name: the h1 is gone and the placeholder div renders.
        expect(container.querySelector('h1')).toBeNull()
        cleanup()

        // Two authors: the second gets the comma; a nickname-less author
        // renders just the name (the nickname && name arms).
        renderPanel({
            authors: [
                { __typename: 'User', id: 'u1', name: 'Autor Jeden', nickname: null },
                { __typename: 'User', id: 'u2', name: 'Autor Dva', nickname: 'Přezdívka' },
            ],
        })
        expect(document.body.textContent).toContain('Autor Jeden, ')
        // A nickname plus a name renders the space between them.
        expect(document.body.textContent).toContain('Přezdívka Autor Dva')
    })

    it('separates two groups by comma (the group n > 0 arm)', () => {
        renderPanel({
            groupAuthor: [
                { __typename: 'Group', id: 'gr1', name: 'Skupina XY' },
                { __typename: 'Group', id: 'gr2', name: 'Skupina ZZ' },
            ],
        })
        expect(document.body.textContent).toContain('Skupina XY, ')
        expect(document.body.textContent).toContain('Skupina ZZ')
    })
})
