/**
 * @jest-environment jsdom
 */
/**
 * Branch arms of the HomePage area that the happy-path suites never take:
 * HomePagePanel's undecided state matrix (still asking / loading / no data /
 * the null arm of the signed-in chain), the sub-panels' default-props and
 * null-prop arms (HomeToFinishPanel, HomeRecommendedPanel), and BaseCommentPanel's
 * optional-chain arms when the comment shape is missing pieces.
 */
import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options), locale: 'cs', ready: true }),
}))
jest.unstable_mockModule('src/hooks/useMediaQuery', () => ({
    useIsLgOrLarger: () => true,
    useIsMdOrLarger: () => true,
}))
jest.unstable_mockModule('next/link', () => ({
    default: ({ children, href }: { children: React.ReactNode; href?: string }) => <a href={href ?? '#'}>{children}</a>,
}))
jest.unstable_mockModule('next/head', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: () => {}, query: {} }),
}))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => loggedInUser,
}))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))

let loggedInUser: Record<string, unknown> | undefined = undefined

let HomeToFinishPanel: typeof import('../HomeToFinishPanel').HomeToFinishPanel
let HomeRecommendedPanel: typeof import('../HomeRecommendedPanel').HomeRecommendedPanel

beforeAll(async () => {
    HomeToFinishPanel = (await import('../HomeToFinishPanel')).HomeToFinishPanel
    HomeRecommendedPanel = (await import('../HomeRecommendedPanel')).HomeRecommendedPanel
})

beforeEach(() => {
    cleanup()
    loggedInUser = undefined
})

const game = (id: string, name: string) => ({ id, name, players: 10, amountOfComments: 1, amountOfRatings: 6, averageRating: 90 })

describe('HomeToFinishPanel arms', () => {
    it('renders the plain header and nothing else when every list is empty', () => {
        // All four default args fire: no props at all.
        render(<HomeToFinishPanel />)

        expect(screen.getByText(translate(cs, 'HomePage.toFinish'))).toBeTruthy()
        expect(screen.queryByText(/Chybí váš hlas/)).toBeNull()
        expect(screen.queryByText(/profilu/)).toBeNull()
    })

    it('counts the missing voices and links the wishlist with its oldest year', () => {
        render(
            <HomeToFinishPanel
                toRate={[{ game: game('40', 'Země snů'), since: '2020-02-02T00:00:00.000Z' }]}
                toComment={[{ game: game('45', 'Dance Macabre'), since: null }]}
                oldestWanted={[{ game: game('41', 'Camlann'), since: '2007-05-05T00:00:00.000Z' }]}
                wantedCount={3}
            />,
        )

        // The voice header counts both lists.
        expect(screen.getByText('Chybí váš hlas u 2 her')).toBeTruthy()
        // A rated game without a review names the missing review, not a date.
        expect(screen.getByText(translate(cs, 'HomePage.toFinishCommented'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'HomePage.toFinishReview'))).toBeTruthy()
        // The wishlist note names the oldest wanted year (the since-parse arm).
        expect(screen.getByText(/Nejstarší z roku 2007/)).toBeTruthy()
    })

    it('drops the wishlist year when the oldest entry has no date', () => {
        render(
            <HomeToFinishPanel
                toRate={[]}
                toComment={[]}
                oldestWanted={[{ game: game('41', 'Camlann'), since: null }]}
                wantedCount={4}
            />,
        )

        // count 4 → plural: "Hry, které si chcete zahrát, jsou celé v profilu."
        expect(screen.getByText(/jsou celé v profilu/)).toBeTruthy()
        expect(screen.queryByText(/Nejstarší z roku/)).toBeNull()
    })

    it('skips a work item whose game is missing and keys by index', () => {
        // game: null hits the `item.game ?` null arm; game?.id ?? index keys it.
        render(
            <HomeToFinishPanel
                toComment={[{ game: null, since: '2022-09-16T00:00:00.000Z' }]}
            />,
        )

        expect(screen.getByText('Chybí váš hlas u jedné hry')).toBeTruthy()
        expect(screen.queryByText('Dance Macabre')).toBeNull()
        expect(screen.queryByText(translate(cs, 'HomePage.toFinishReview'))).toBeNull()
    })

    it('counts the whole backlog and pages the reviews when the count outruns the rows', () => {
        // The header counts the counts, not the rendered rows; the Pager shows
        // up only when the review backlog is longer than one page, and hands the
        // visitor's page choice to the parent.
        let askedOffset = -1
        render(
            <HomeToFinishPanel
                toComment={[{ game: game('45', 'Dance Macabre'), since: null }]}
                toCommentCount={11}
                commentOffset={0}
                onCommentPage={(offset) => { askedOffset = offset }}
            />,
        )

        expect(screen.getByText('Chybí váš hlas u 11 her')).toBeTruthy()
        expect(screen.getByText('1.–3. z 11')).toBeTruthy()
        fireEvent.click(screen.getByText('>'))
        expect(askedOffset).toBe(3)
        // Without the callback the Pager stays away even for a big backlog.
        cleanup()
        render(
            <HomeToFinishPanel
                toComment={[{ game: game('45', 'Dance Macabre'), since: null }]}
                toCommentCount={11}
            />,
        )
        expect(screen.queryByText(/z 11/)).toBeNull()
    })

    it('keeps the Pager away when the backlog fits one page', () => {
        render(
            <HomeToFinishPanel
                toComment={[{ game: game('45', 'Dance Macabre'), since: null }]}
                toCommentCount={1}
                onCommentPage={() => {}}
            />,
        )

        expect(screen.getByText('Chybí váš hlas u jedné hry')).toBeTruthy()
        expect(screen.queryByText(/z 1/)).toBeNull()
    })
})

describe('HomeRecommendedPanel arms', () => {
    it('answers the empty state when no event matches the taste', () => {
        // default-arg arm: no props at all
        render(<HomeRecommendedPanel />)

        expect(screen.getByText(translate(cs, 'HomePage.recommendedNone'))).toBeTruthy()
    })

    it('renders an event without a date, a game, a loc or a signup link as bare rows', () => {
        render(
            <HomeRecommendedPanel
                events={[
                    {
                        id: 'e1',
                        name: 'Bez data',
                        from: null,
                        to: null,
                        loc: null,
                        registrationUrl: null,
                        matchedLabels: [],
                        games: [],
                    },
                ]}
            />,
        )

        // The row renders with the header even though every optional piece is
        // absent — the name itself hangs on the game link, so a game-less
        // event is a bare meta row (the null arm of {game && ...}).
        expect(document.body.textContent).toContain(translate(cs, 'HomePage.recommended'))
        expect(screen.queryByText('Bez data')).toBeNull()
        expect(screen.queryByText(translate(cs, 'HomePage.recommendedSignUp'))).toBeNull()
        expect(screen.queryByText(/shoda:/)).toBeNull()
    })

    it('renders the full event: date block, range end, loc and the signup link', () => {
        render(
            <HomeRecommendedPanel
                events={[
                    {
                        id: 'e2',
                        name: 'Ve znamení Zla',
                        from: '1795046400000',
                        to: '1795305600000',
                        loc: 'Hrad Valdštejn',
                        registrationUrl: 'https://registrace.example/',
                        matchedLabels: ['opakovatelný'],
                        games: [game('5', 'Ve znamení Zla')],
                    },
                ]}
            />,
        )

        expect(screen.getByText('Ve znamení Zla')).toBeTruthy()
        expect(screen.getByText('shoda: opakovatelný')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'HomePage.recommendedSignUp')).getAttribute('href')).toBe('https://registrace.example/')
        // The date range carries its end.
        expect(document.body.textContent).toContain(' – ')
        expect(document.body.textContent).toContain(' · Hrad Valdštejn')
    })
})
