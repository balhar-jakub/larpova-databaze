/**
 * @jest-environment jsdom
 */
/**
 * The user profile area: the profile panel (authored/played games, the
 * iCal link, the empty layout without games) and the profile tabs
 * (profile-only vs full navigation).
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

// jsdom does not implement matchMedia (the layout hooks ask for the viewport).
window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
})) as unknown as typeof window.matchMedia

const tabClicks: string[] = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: () => undefined, pathname: '/', query: {} }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({}),
    useQuery: () => ({ data: undefined, loading: false }),
    useMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        userSettings: () => ({ href: '/profile?id=settings', as: '/profile/settings' }),
        changePassword: () => ({ href: '/profile?id=changePassword', as: '/profile/changePassword' }),
        userProfile: (id: string) => ({ href: `/profile?id=${id}`, as: `/profil/${id}` }),
        gameDetail: (id: string, name?: string | null) => ({ href: `/gameDetail?id=${id}`, as: `/larp/${id}` }),
        push: (r: { as: string }) => { tabClicks.push(r.as) },
    }),
}))
jest.unstable_mockModule('../UserDetailPanel', () => ({
    default: ({ userData }: { userData?: { name?: string | null } }) => <div data-testid="user-detail">{userData?.name ?? 'anon'}</div>,
}))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../common/Tabs/Tabs', () => ({
    Tabs: ({ tabs, onSelectTab }: { tabs: Array<{ key: string; title: string }>; onSelectTab?: (k: string) => void }) => (
        <div data-testid="tabs">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => onSelectTab?.(tab.key)}>{tab.title}</button>)}</div>
    ),
}))
jest.unstable_mockModule('../../common/DetailGameList/DetailGameList', () => ({
    default: ({ games }: { games: Array<{ id: string; name?: string | null }> }) => (
        <div data-testid="game-list">{games.map((g) => g.name).join(', ')}</div>
    ),
}))

let UserProfilePanel: typeof import('../UserProfilePanel')['default']
let UserProfileTabs: typeof import('../UserProfileTabs')['default']

beforeAll(async () => {
    UserProfilePanel = (await import('../UserProfilePanel')).default
    UserProfileTabs = (await import('../UserProfileTabs')).default
})

beforeEach(() => {
    cleanup()
    tabClicks.length = 0
})

const user = {
    __typename: 'User',
    id: 'u1',
    name: 'Jakub Balhar',
    nickname: 'Balda',
    email: 'jakub@example.test',
    city: 'Praha',
    authoredGames: [{ __typename: 'Game', id: 'g1', name: 'Autorovaná hra' }],
    playedGames: [
        {
            __typename: 'PlayedGame',
            game: { __typename: 'Game', id: 'g2', name: 'Hraná hra' },
            rating: 9,
        },
    ],
    commentsPaged: {
        __typename: 'CommentsPaged',
        totalAmount: 1,
        comments: [
            {
                __typename: 'Comment',
                id: 'c1',
                added: '2027-01-01',
                amountOfUpvotes: 0,
                comment: '<p>Komentář</p>',
                isHidden: false,
                user: { __typename: 'User', id: 'u1', name: 'Jakub Balhar', nickname: 'Balda', image: null },
                game: { __typename: 'Game', id: 'g1', name: 'Autorovaná hra', year: 2026, amountOfComments: 1, amountOfRatings: 2, averageRating: 90, totalRating: 180, labels: [] },
            },
        ],
    },
}

describe('UserProfilePanel', () => {
    it('renders the user detail, authored and played games', () => {
        render(<UserProfilePanel userId="u1" user={user as never} />)

        expect(screen.getByTestId('user-detail').textContent).toBe('Jakub Balhar')
        expect(screen.getByRole('button', { name: translate(cs, 'UserDetail.profile') })).toBeTruthy()
        expect(screen.getByTestId('game-list').textContent).toContain('Autorovaná hra')
    })

    it('exposes the iCal subscription link in the right column', async () => {
        render(<UserProfilePanel userId="u1" user={user as never} />)

        await waitFor(() => expect(document.body.innerHTML).toContain('/ical?id=u1'))
    })

    it('shows the loading state without a user', () => {
        render(<UserProfilePanel userId="u1" />)
        expect(screen.getByText('loading')).toBeTruthy()
    })

    it('renders only the profile tab when profileOnly', () => {
        render(<UserProfilePanel userId="u1" user={user as never} profileOnly />)
        expect(screen.getByText(translate(cs, 'UserDetail.profile'))).toBeTruthy()
        expect(screen.queryByText(translate(cs, 'UserDetail.settings'))).toBeNull()
    })
})

describe('UserProfileTabs', () => {
    it('navigates to settings and password via the tabs', async () => {
        render(<UserProfileTabs selectedTab="profile" />)

        expect(screen.getByText(translate(cs, 'UserDetail.profile'))).toBeTruthy()

        fireEvent.click(screen.getByText(translate(cs, 'UserDetail.settings')))
        await waitFor(() => expect(tabClicks[0]).toBe('/profile/settings'))

        fireEvent.click(screen.getByText(translate(cs, 'UserDetail.changePassword')))
        await waitFor(() => expect(tabClicks[1]).toBe('/profile/changePassword'))
    })
})
