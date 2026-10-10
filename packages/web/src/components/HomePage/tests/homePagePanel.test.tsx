/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The anonymous homepage: what the visitor reads before they have an account.
 * These tests pin the decisions of the redesign — the hero states the size of
 * the database, the label tiles lead into the catalog with the filter already
 * applied, "Nejoblíbenější" is gone, the comment block is one row of three and
 * nothing on the page renders an HTML entity as text.
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

let queryResult: Record<string, unknown> = {}
const pushMock = jest.fn()

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options), locale: 'cs', ready: true }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => queryResult,
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: pushMock, query: {} }),
}))
jest.unstable_mockModule('next/link', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('next/head', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
// `undefined` is the provider's settled "nobody is signed in" — an empty object
// would mean it is still asking, and the page renders nothing then.
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => undefined,
}))
jest.unstable_mockModule('src/hooks/useMediaQuery', () => ({
    useIsLgOrLarger: () => true,
}))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
// The real card links through the Next router and the comment body pulls in its
// own fragment; the cards themselves are what the page renders, so only the link
// is replaced.
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ children }: { children: React.ReactNode }) => <a href="/larp/test">{children}</a>,
}))
jest.unstable_mockModule('../BaseCommentPanel', () => ({
    BaseCommentPanel: ({ comment }: { comment?: { commentAsText?: string | null } }) => (
        <div>{comment?.commentAsText}</div>
    ),
}))

let Panel: typeof import('../HomePagePanel').HomePagePanel

beforeAll(async () => {
    Panel = (await import('../HomePagePanel')).HomePagePanel
})

const game = (id: string, name: string) => ({ id, name, players: 10, amountOfComments: 1, amountOfRatings: 6, averageRating: 90 })
const comment = (id: string, text: string) => ({
    id,
    added: '2026-09-14T10:00:00.000Z',
    commentAsText: text,
    game: { id: '5', name: 'Havraní ostrov' },
    user: { id: '9', name: 'Triss', nickname: 'Triss' },
})

const answer = () => ({
    loading: false,
    refetch: () => {},
    client: { readFragment: () => null },
    data: {
        homepage: {
            stats: { games: 1512, events: 2733, upcomingEvents: 40, users: 3170, labels: 61 },
            topLabels: [
                { id: '16', name: 'komorní', count: 802, isRequired: false },
                { id: '2', name: 'dramatický', count: 211, isRequired: false },
            ],
            bestRatedGames: [game('1', 'Legie: Sibiřský příběh')],
            lastAddedGames: [game('2', 'MethanCity')],
            nextEvents: [],
            openRegistrationEvents: [
                {
                    id: '32',
                    name: 'Erebos — 6. běh',
                    from: '1812422400000',
                    to: '1812595200000',
                    loc: 'Praha',
                    amountOfPlayers: 40,
                    registrationUrl: 'https://docs.google.com/forms/erebos',
                    registrationOpen: true,
                },
                {
                    id: '33',
                    name: 'Erebos — 7. běh',
                    from: '1813027200000',
                    to: '1813200000000',
                    loc: 'Praha',
                    amountOfPlayers: 40,
                    registrationUrl: 'https://docs.google.com/forms/erebos-7',
                    registrationOpen: true,
                },
            ],
            lastComments: [
                comment('1', 'Komentář na Blackhillu .'),
                comment('2', 'Druhý komentář'),
                comment('3', 'Třetí komentář'),
            ],
        },
    },
})

beforeEach(() => {
    pushMock.mockClear()
    queryResult = answer()
})

test('the hero says how big the database is', () => {
    render(<Panel />)

    expect(
        screen.getByText('Databáze 1512 her, 2733 akcí a 3170 lidí — 40 akcí se teprve koná.'),
    ).toBeTruthy()
})

test('a label tile leads into the catalog with that label filtered', () => {
    render(<Panel />)

    const tile = screen.getByText('komorní').closest('button') as HTMLButtonElement
    fireEvent.click(tile)

    expect(pushMock).toHaveBeenCalledWith('/games?labels=16')
})

test('the best rated block states its gate and the page never says Nejoblíbenější', () => {
    render(<Panel />)

    expect(screen.getByText('Nejlépe hodnocené')).toBeTruthy()
    expect(screen.getByText('jen hry od 5 hlasů')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Nejoblíbenější')
})

test('a game card names its numbers instead of stacking bare digits', () => {
    render(<Panel />)

    // "10 1 6 x" is what the visitor used to read under the icons.
    expect(screen.getAllByText('10 hráčů').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1 komentář').length).toBeGreaterThan(0)
    expect(screen.getAllByText('6 hodnocení').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('6 x')
})

test('the comment block is one row of three that leads to the catalog', () => {
    render(<Panel />)

    expect(screen.getByText('Komentář na Blackhillu .')).toBeTruthy()
    expect(screen.getByText('Druhý komentář')).toBeTruthy()
    expect(screen.getByText('Třetí komentář')).toBeTruthy()
    expect(screen.getByText('všechny komentáře »').getAttribute('href')).toBe('/games?order=MostCommented')
    // The block no longer grows in place — "+ Více…" is what made it half the page.
    expect(screen.queryByText('+ Více...')).toBeNull()
})

test('with nothing written yet the comment block is not rendered at all', () => {
    const empty = answer()
    ;(empty.data as any).homepage.lastComments = []

    queryResult = empty
    render(<Panel />)

    expect(screen.queryByText('Poslední komentáře')).toBeNull()
    expect(screen.getByText('Přidejte svůj larp')).toBeTruthy()
})

test('the open-registration block lists the events with the sign-up link right in the row', () => {
    render(<Panel />)

    expect(screen.getByText('Přihlášky otevřené')).toBeTruthy()
    expect(screen.getByText('Erebos — 6. běh')).toBeTruthy()
    expect(screen.getByText('Erebos — 7. běh')).toBeTruthy()

    // The sign-up link is the row's action, not a detail one click away.
    const signUp = screen.getAllByText('Přihlašování otevřeno').map((node) => node.closest('a'))
    expect(signUp).toHaveLength(2)
    expect(signUp[0]).toBeTruthy()
    expect((signUp[0] as HTMLAnchorElement).getAttribute('href')).toBe('https://docs.google.com/forms/erebos')

    // "The whole calendar" continues the block's story: only the open
    // registrations, the filter already applied.
    expect(screen.getAllByText('celý kalendář »')[1].getAttribute('href')).toBe('/kalendar?reg=1')
})

test('with no open registration the block leaves no hole in the row', () => {
    const empty = answer()
    ;(empty.data as any).homepage.openRegistrationEvents = []

    queryResult = empty
    render(<Panel />)

    expect(screen.queryByText('Přihlášky otevřené')).toBeNull()
    // The rest of the row still renders.
    expect(screen.getByText('Nejlépe hodnocené')).toBeTruthy()
})

test('the page closes by asking for a contribution', () => {
    render(<Panel />)

    expect(screen.getByText('Přidejte svůj larp')).toBeTruthy()
    expect(screen.getByText('Vytvořit účet').getAttribute('href')).toBe('/signUp')
    expect(screen.getByText('Přidat hru').getAttribute('href')).toBe('/gameEdit')
})
