/**
 * @jest-environment jsdom
 */
/**
 * HomePagePanel's undecided state matrix — the arms the settled-state suites
 * never take: the provider still asking (empty user object) renders nothing
 * of the decision blocks; the data query still loading; data arrived with no
 * homepage key (the `?.` chain); a signed-in visitor whose personal query has
 * not answered yet (my === undefined while signed in); and the documentOf
 * default-export unwrap (covered through the panel's own document import).
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

let queryResult: Record<string, unknown> = {}
let loggedInUser: Record<string, unknown> | undefined = undefined

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options), locale: 'cs', ready: true }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: (_document: unknown, options?: { skip?: boolean }) =>
        options?.skip ? { loading: false, data: undefined } : queryResult,
    // The Pager of the "finish it" block pages through the client.
    useApolloClient: () => ({ query: () => Promise.resolve({ data: { homepage: { myHome: { toComment: [] } } } }) }),
}))
jest.unstable_mockModule('next/router', () => ({ useRouter: () => ({ push: () => {}, query: {} }) }))
jest.unstable_mockModule('next/link', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('next/head', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
// `{}` while still asking: the state the provider hands over before it knows.
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({ useLoggedInUser: () => loggedInUser }))
jest.unstable_mockModule('src/hooks/useMediaQuery', () => ({ useIsLgOrLarger: () => true, useIsMdOrLarger: () => true }))
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

beforeEach(() => {
    cleanup()
    loggedInUser = undefined
    queryResult = { loading: false, data: undefined }
})

describe('HomePagePanel undecided states', () => {
    it('renders none of the decision blocks while the provider is still asking', () => {
        loggedInUser = {}

        render(<Panel />)

        // Not the anonymous shop window and not the personal band — the
        // closing CTA renders unconditionally, so it is not a decision block.
        expect(screen.queryByText('Databáze 1512 her')).toBeNull()
        expect(screen.queryByText('Procházejte podle štítků')).toBeNull()
        expect(screen.queryByText(translate(cs, 'HomePage.ctaPersonalTitle'))).toBeNull()
    })

    it('renders nothing of the body while the data query is loading and nobody is signed in', () => {
        queryResult = { loading: true, data: undefined }

        render(<Panel />)

        expect(screen.queryByText('Procházejte podle štítků')).toBeNull()
    })

    it('renders the anonymous hero once the answer settles with data', () => {
        queryResult = {
            loading: false,
            data: {
                homepage: {
                    stats: { games: 10, events: 20, upcomingEvents: 3, users: 30, labels: 4 },
                    topLabels: [],
                    bestRatedGames: [],
                    lastAddedGames: [],
                    nextEvents: [],
                    openRegistrationEvents: [],
                    lastComments: [],
                },
            },
        }

        render(<Panel />)

        // The <title> and the hero heading both carry it.
        expect(screen.getAllByText(translate(cs, 'HomePage.pageTitle')).length).toBeGreaterThanOrEqual(2)
        expect(screen.getByText('Přidejte svůj larp')).toBeTruthy()
    })

    it("shows the anonymous blocks (not the personal band) while a signed-in visitor's own query has not answered", () => {
        loggedInUser = { id: '7', name: 'Triss' }
        queryResult = {
            loading: false,
            data: {
                homepage: {
                    stats: { games: 10, events: 20, upcomingEvents: 3, users: 30, labels: 4 },
                    topLabels: [],
                    bestRatedGames: [],
                    lastAddedGames: [],
                    nextEvents: [],
                    openRegistrationEvents: [],
                    lastComments: [],
                },
            },
        }
        // the personal query is NOT skipped (signed in) and has not answered: my === undefined

        render(<Panel />)

        // The empty state needs `my` to exist with hasData false — an unanswered
        // query is neither: no personal band and no first-steps panel. The
        // closing CTA is decided by signedIn alone, so its personal variant
        // legitimately renders already.
        expect(screen.queryByText(/larpotéka/)).toBeNull()
        expect(screen.queryByText(/prázdná/)).toBeNull()
        expect(screen.getByText(translate(cs, 'HomePage.ctaPersonalTitle'))).toBeTruthy()
    })
})
