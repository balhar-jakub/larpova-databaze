/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The homepage of a signed-in visitor. These tests pin what makes it a different
 * page: the events of the games they want to play lead it, the general blocks
 * are gone, the closing band stops offering them a registration, and an account
 * with nothing in the database gets the first steps instead of five empty
 * blocks.
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

let queryResult: Record<string, unknown> = {}
let loggedInUser: Record<string, unknown> | undefined = undefined

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options), locale: 'cs', ready: true }),
}))
// The personal query is skipped for an anonymous visitor, so the mock has to
// answer "no data" for a skipped call — otherwise the page would render the
// personal blocks for somebody who is not signed in.
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: (_document: unknown, options?: { skip?: boolean }) =>
        options?.skip ? { loading: false, data: undefined } : queryResult,
}))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => loggedInUser,
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: () => {}, query: {} }),
}))
jest.unstable_mockModule('next/link', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('next/head', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('src/hooks/useMediaQuery', () => ({
    useIsLgOrLarger: () => true,
}))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ children }: { children: React.ReactNode }) => <a href="/larp/test">{children}</a>,
}))
jest.unstable_mockModule('../BaseCommentPanel', () => ({
    BaseCommentPanel: ({ comment }: { comment?: { commentAsText?: string | null } }) => <div>{comment?.commentAsText}</div>,
}))

let Panel: typeof import('../HomePagePanel').HomePagePanel

beforeAll(async () => {
    Panel = (await import('../HomePagePanel')).HomePagePanel
})

const game = (id: string, name: string) => ({ id, name, players: 10, amountOfComments: 1, amountOfRatings: 6, averageRating: 90 })

const personalAnswer = () => ({
    loading: false,
    refetch: () => {},
    client: { readFragment: () => null },
    data: {
        homepage: {
            stats: { games: 1512, events: 2733, upcomingEvents: 40, users: 3170, labels: 61 },
            topLabels: [{ id: '16', name: 'komorní', count: 802, isRequired: false }],
            bestRatedGames: [game('1', 'Legie: Sibiřský příběh')],
            lastAddedGames: [game('2', 'MethanCity')],
            nextEvents: [
                { id: '77', name: 'Bitva o Fort', from: '1795046400000', to: '1795305600000', loc: 'Brno', amountOfPlayers: 200 },
            ],
            lastComments: [],
            myHome: {
                playedCount: 110,
                wantedCount: 19,
                authoredCount: 15,
                commentsCount: 51,
                hasData: true,
                wantedWithoutEvent: 18,
                myEvents: [
                    {
                        id: '2798',
                        name: 'Krvavé časy 1313 — 10. běh',
                        from: '1795046400000',
                        to: '1795305600000',
                        loc: 'Hrad Valdštejn',
                        amountOfPlayers: 40,
                        games: [game('31', 'Krvavé časy')],
                    },
                ],
                toRate: [{ game: game('40', 'Země snů: Sen ve stínech'), since: '2020-02-02T00:00:00.000Z' }],
                toComment: [
                    { game: game('45', 'Dance Macabre'), since: '2012-05-05T00:00:00.000Z' },
                    { game: game('46', 'Fallen'), since: '2022-09-16T00:00:00.000Z' },
                ],
                oldestWanted: [{ game: game('41', 'Camlann'), since: '2007-05-05T00:00:00.000Z' }],
                authored: [
                    {
                        game: game('50', 'Zpěvy rytířské'),
                        lastRating: { rating: 9, added: '2026-07-13T00:00:00.000Z' },
                    },
                    { game: game('51', 'Castaways'), lastRating: null },
                ],
                authoredComments: [
                    {
                        id: '900',
                        commentAsText: 'Milý a něžný larp, který zahřeje na duši.',
                        added: '2022-08-25T19:18:26.000Z',
                        user: { id: '5', name: 'Tara Rees', nickname: '' },
                        game: game('52', 'Mumini'),
                    },
                ],
                recommendedLabels: [
                    { id: '4', name: 'opakovatelný', count: 33 },
                    { id: '16', name: 'komorní', count: 28 },
                ],
                recommended: [game('60', 'Špetka magie')],
                recommendedEvents: [
                    {
                        id: '2825',
                        name: 'Ve znamení Zla — 11. běh',
                        from: '1793961600000',
                        to: '1794220800000',
                        loc: '',
                        registrationUrl: 'https://registrace.vzz.imerze.cz/',
                        registrationOpen: true,
                        matchedLabels: ['opakovatelný', 'horor'],
                        games: [game('52000', 'Ve znamení Zla')],
                    },
                ],
            },
        },
    },
})

beforeEach(() => {
    queryResult = personalAnswer()
    loggedInUser = { id: '1', name: 'Balda' }
})

test('a signed-in visitor gets their own numbers, not the anonymous hero', () => {
    render(<Panel />)

    expect(screen.getByText('Ahoj Balda')).toBeTruthy()
    expect(screen.getByText('tvoje larpotéka má 110 hraných her')).toBeTruthy()
    // The "want to play" number is gone from the band — the band counts what
    // awaits the visitor's voice instead, the wishlist lives in the profile.
    expect(screen.getByText('110 hraných her · 15 vašich her · 51 komentářů · 3 hry čekají na váš hlas')).toBeTruthy()
    expect(document.body.textContent).not.toContain('19 her, které chcete hrát')
    // Twice on purpose: the personal bar leads there and so does the closing band.
    expect(screen.getAllByText('Moje stránka')[0].getAttribute('href')).toBe('/profile/current')
    // The anonymous shop window is gone.
    expect(screen.queryByText('Procházejte podle štítků')).toBeNull()
    expect(document.body.textContent).not.toContain('Databáze 1512 her')
})

test('the events of the games they want to play lead the page', () => {
    render(<Panel />)

    expect(screen.getByText('Události z vašich her')).toBeTruthy()
    expect(screen.getByText('z her v seznamu „Chci hrát“')).toBeTruthy()
    expect(screen.getByText('Krvavé časy 1313 — 10. běh')).toBeTruthy()
    // The way out for the 17 of 40 events with no game at all, and the ICS feed.
    expect(screen.getByText('18 z 19 her v seznamu „Chci hrát“ se v kalendáři ještě neobjevuje.')).toBeTruthy()
    expect(screen.getByText('Odebírat ICS').getAttribute('href')).toBe('/ical?id=1')
})

test('the page names what to finish and what the visitor\'s own games are doing', () => {
    render(<Panel />)

    // Every row is about the missing voice: the unplayed rating and the missing review.
    expect(screen.getByText('Chybí váš hlas u 3 her')).toBeTruthy()
    expect(screen.getByText('Země snů: Sen ve stínech')).toBeTruthy()
    expect(screen.getByText('Hrál jste 02.02.2020 a hra nemá váš hlas.')).toBeTruthy()
    expect(screen.getByText('Dance Macabre')).toBeTruthy()
    expect(screen.getAllByText('ohodnotil jste, chybí pár vět pro ostatní').length).toBe(2)
    expect(screen.getAllByText('Dopsat recenzi »').length).toBe(2)
    // The wishlist is a one-line pointer, not a work item.
    expect(screen.getByText('Hry, které si chcete zahrát, jsou celé v profilu. Nejstarší z roku 2007.')).toBeTruthy()

    expect(screen.getByText('Tvoje hry')).toBeTruthy()
    expect(screen.getByText('Zpěvy rytířské')).toBeTruthy()
    // The last vote is back as the same colour square the games carry in lists,
    // with the date next to it — and with no voter.
    expect(screen.getByText('Castaways')).toBeTruthy()
    const panel = screen.getByTestId('homeAuthored.panel')
    const badges = panel.querySelectorAll('[data-testid="homeAuthored.voteBadge"]')
    expect(badges.length).toBe(1)
    expect(badges[0].getAttribute('aria-label')).toBe('Silně doporučuji')
    expect(screen.getByText('13.07.2026')).toBeTruthy()
    // The voter's name is nowhere: not in the block, not in the header.
    expect(screen.queryByText('Triss')).toBeNull()
    expect(screen.queryByText('Od koho')).toBeNull()
})

test('the newest comments under the visitor\'s own games have their own block', () => {
    render(<Panel />)

    expect(screen.getByText('K vašim hrám')).toBeTruthy()
    expect(screen.getByText('Mumini')).toBeTruthy()
    expect(screen.getByText('· Tara Rees:')).toBeTruthy()
    expect(screen.getByText('Milý a něžný larp, který zahřeje na duši.')).toBeTruthy()
    expect(screen.getByText('25.08.2022')).toBeTruthy()
})

test('the recommendation offers signable events built from the visitor\'s taste', () => {
    render(<Panel />)

    expect(screen.getByText('Stojí za to')).toBeTruthy()
    expect(screen.getByText('hry s otevřenou přihláškou podle štítků her, které vám šly')).toBeTruthy()
    // The event, why it is here, and the way to act on it.
    expect(screen.getByText('Ve znamení Zla — 11. běh')).toBeTruthy()
    expect(screen.getByText('shoda: opakovatelný, horor')).toBeTruthy()
    expect(screen.getByText('Přihlásit se »').getAttribute('href')).toBe('https://registrace.vzz.imerze.cz/')
    // The old catalog-card recommendation is gone.
    expect(screen.queryByText('Špetka magie')).toBeNull()
    expect(screen.queryByText('Doporučeno podle štítků')).toBeNull()
})

test('the general blocks and the registration band are gone for a signed-in visitor', () => {
    render(<Panel />)

    expect(screen.queryByText('Nejlépe hodnocené')).toBeNull()
    expect(screen.queryByText('Poslední komentáře')).toBeNull()
    expect(screen.queryByText('Vytvořit účet')).toBeNull()
    expect(screen.getByText('Podělte se o svůj larp')).toBeTruthy()
    // The calendar stays: a visitor whose games have no event still needs it.
    expect(screen.getByText('Nejbližší akce')).toBeTruthy()
})

test('an account with nothing gets the first steps and the anonymous content', () => {
    const empty = personalAnswer()
    const home = (empty.data as any).homepage
    home.myHome = {
        ...home.myHome,
        playedCount: 0,
        wantedCount: 0,
        authoredCount: 0,
        commentsCount: 0,
        hasData: false,
        myEvents: [],
        toRate: [],
        toComment: [],
        oldestWanted: [],
        authored: [],
        authoredComments: [],
        recommendedLabels: [],
        recommended: [],
        recommendedEvents: [],
    }
    queryResult = empty
    loggedInUser = { id: '2', name: 'Nový' }

    render(<Panel />)

    expect(screen.getByText('Nový, vaše larpotéka je zatím prázdná')).toBeTruthy()
    expect(screen.getByText('Vyplňte profil')).toBeTruthy()
    expect(screen.getByText('Projděte katalog')).toBeTruthy()
    expect(screen.getByText('Přidejte hru')).toBeTruthy()
    // The anonymous content is what they get instead of empty blocks.
    expect(screen.getByText('Nejlépe hodnocené')).toBeTruthy()
    expect(screen.queryByText('Události z vašich her')).toBeNull()
})

test('an anonymous visitor never sees the personal blocks', () => {
    loggedInUser = undefined

    render(<Panel />)

    expect(screen.getByText('Databáze 1512 her, 2733 akcí a 3170 lidí — 40 akcí se teprve koná.')).toBeTruthy()
    expect(screen.queryByText('Události z vašich her')).toBeNull()
    expect(screen.queryByText('Tvoje hry')).toBeNull()
    expect(screen.getByText('Vytvořit účet')).toBeTruthy()
})
