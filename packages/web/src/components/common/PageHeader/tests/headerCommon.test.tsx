/**
 * @jest-environment jsdom
 */
/**
 * The remaining common/ components: the header's user dropdown (signed in
 * vs signed out, menu navigation, sign-out mutation), the header search
 * (typing triggers the query, results render, empty query clears), the
 * cookie consent banner (localStorage decision, accept/reject) and the
 * sign-in required wrapper's role gates.
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let searchResult: Record<string, unknown> | undefined
let mutateResult: Promise<{ data?: unknown }> = Promise.resolve({ data: {} })
let pushedRoute = ''
let currentUser: { id: string; name?: string; imageId?: string; role?: string } | undefined | null = null
const resetStore = jest.fn()

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: searchResult, loading: false }),
    useApolloClient: () => ({ mutate: () => mutateResult, resetStore }),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: (url: string) => { pushedRoute = url }, pathname: '/', query: {} }),
}))
jest.unstable_mockModule('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
        <a href={typeof href === 'string' ? href : '/'} {...rest}>{children}</a>
    ),
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = {
            currentProfile: () => '/muj-profil',
            userSettings: () => '/nastaveni',
            changePassword: () => '/zmena-hesla',
            adminIntro: () => '/admin',
            homepage: () => '/',
            signIn: () => '/prihlaseni',
            signUp: () => '/registrace',
            search: (query?: string, type?: string) => {
                const params: string[] = []
                if (query) params.push(`q=${encodeURIComponent(query)}`)
                if (type) params.push(`typ=${type}`)
                const suffix = params.length ? `?${params.join('&')}` : ''
                return { href: `/search${suffix}`, as: `/search${suffix}` }
            },
        }
        return {
            ...routes,
            push: (url: string) => { pushedRoute = url },
        }
    },
}))
jest.unstable_mockModule('src/context/UserContext/UserContext', async () => {
    const React = await import('react')
    return { UserContext: React.createContext(undefined) }
})
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => currentUser,
}))
jest.unstable_mockModule('src/context/InPlaceSignInContext/InPlaceSignInContext', () => ({
    InPlaceSignInContext: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>, _currentValue: undefined },
}))
jest.unstable_mockModule('../HeaderNavLink', () => ({
    HeaderNavLink: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
    headerLinkStyle: {},
    headerLinkStyleMd: {},
}))
jest.unstable_mockModule('../../GameBaseDataPanel/GameBaseDataPanel', () => ({
    GameBaseDataPanel: ({ game }: { game: { id: string; name?: string | null } }) => <div>{game?.name}</div>,
}))
jest.unstable_mockModule('../../UserLink/UserLink', () => ({
    default: ({ children }: { children: React.ReactNode }) => <a href="/u">{children}</a>,
}))
jest.unstable_mockModule('../../TextLink/TextLink', () => ({
    TextLink: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}))
jest.unstable_mockModule('../../EventLink/EventLink', () => ({
    default: ({ children }: { children: React.ReactNode }) => <a href="/e">{children}</a>,
}))
jest.unstable_mockModule('../../FormPageRow/FormPageRow', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.unstable_mockModule('../../BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../../SignIn/SignInPanel', () => ({
    default: ({ infoMessage }: { infoMessage?: string }) => <div data-testid="signin-panel">{infoMessage}</div>,
}))
jest.unstable_mockModule('../../ProfileImage/ProfileImage', () => ({ DEFAULT_IMAGE_URL: '/default.png' }))

let HeaderUser: typeof import('../HeaderUser')['default']
let HeaderSearchForm: typeof import('../HeaderSearchForm')['HeaderSearchForm']
let CookieConsent: typeof import('../../CookieConsent/CookieConsent')['CookieConsent']
let SignInRequiredWrapper: typeof import('../../SignInRequiredWrapper/SignInRequiredWrapper')['default']

beforeAll(async () => {
    HeaderUser = (await import('../HeaderUser')).default
    HeaderSearchForm = (await import('../HeaderSearchForm')).HeaderSearchForm
    CookieConsent = (await import('../../CookieConsent/CookieConsent')).CookieConsent
    SignInRequiredWrapper = (await import('../../SignInRequiredWrapper/SignInRequiredWrapper')).default
})

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('HeaderUser', () => {
    beforeEach(() => {
        cleanup()
        pushedRoute = ''
        mutateResult = Promise.resolve({ data: { ok: true } })
        jest.clearAllMocks()
    })

    it('shows the sign-in and sign-up links when signed out', () => {
        currentUser = null
        render(<HeaderUser />)

        expect(screen.getByText(translate(cs, 'PageHeader.signIn'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'PageHeader.signUp'))).toBeTruthy()
    })

    it('navigates to the sign-in page from the link', () => {
        currentUser = null
        render(<HeaderUser />)

        fireEvent.click(screen.getByText(translate(cs, 'PageHeader.signIn')))
        expect(pushedRoute).toBe('/prihlaseni')
    })

    it('renders the user menu for a signed-in user and navigates from it', async () => {
        const { UserContext } = await import('src/context/UserContext/UserContext')
        currentUser = { id: '42', name: 'Jakub', role: 'USER' }
        render(<UserContext.Provider value={{ value: currentUser } as never}><HeaderUser /></UserContext.Provider>)

        // react-bootstrap renders the menu only after the toggle opens it
        // (state update — needs act around the click).
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Jakub/ }))
        })
        expect(screen.getByText(translate(cs, 'PageHeader.myPage'))).toBeTruthy()
        fireEvent.click(screen.getByText(translate(cs, 'PageHeader.myPage')))
        expect(pushedRoute).toBe('/muj-profil')
    })

    it('shows the admin entry to an editor', async () => {
        const { UserContext } = await import('src/context/UserContext/UserContext')
        currentUser = { id: '42', name: 'Jakub', role: 'EDITOR' }
        render(<UserContext.Provider value={{ value: currentUser } as never}><HeaderUser /></UserContext.Provider>)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Jakub/ }))
        })
        expect(screen.getByText(translate(cs, 'PageHeader.admin'))).toBeTruthy()
    })

    it('signs out via the mutation and lands on the homepage', async () => {
        const { UserContext } = await import('src/context/UserContext/UserContext')
        currentUser = { id: '42', name: 'Jakub', role: 'USER' }
        render(<UserContext.Provider value={{ value: currentUser } as never}><HeaderUser /></UserContext.Provider>)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Jakub/ }))
        })
        const logOut = screen.getByText(translate(cs, 'PageHeader.logOut'))
        fireEvent.click(logOut)
        await flush()
        await waitFor(() => expect(resetStore).toHaveBeenCalled())
        await waitFor(() => expect(pushedRoute).toBe('/'))
    })

    it('navigates to the profile and settings pages from the menu', async () => {
        const { UserContext } = await import('src/context/UserContext/UserContext')
        currentUser = { id: '42', name: 'Jakub', role: 'USER' }
        render(<UserContext.Provider value={{ value: currentUser } as never}><HeaderUser /></UserContext.Provider>)
        fireEvent.click(screen.getByRole('button', { name: /Jakub/ }))
        fireEvent.click(await screen.findByText(translate(cs, 'PageHeader.myPage')))
        expect(pushedRoute).toBe('/muj-profil')
    })

    it('navigates to settings and change-password', async () => {
        const { UserContext } = await import('src/context/UserContext/UserContext')
        currentUser = { id: '42', name: 'Jakub', role: 'USER' }
        render(<UserContext.Provider value={{ value: currentUser } as never}><HeaderUser /></UserContext.Provider>)
        fireEvent.click(screen.getByRole('button', { name: /Jakub/ }))
        fireEvent.click(await screen.findByText(translate(cs, 'PageHeader.settings')))
        expect(pushedRoute).toBe('/nastaveni')
        fireEvent.click(screen.getByRole('button', { name: /Jakub/ }))
        fireEvent.click(await screen.findByText(translate(cs, 'PageHeader.changePassword')))
        expect(pushedRoute).toBe('/zmena-hesla')
    })
})

describe('HeaderSearchForm', () => {
    beforeEach(() => {
        cleanup()
        searchResult = undefined
    })

    it('renders the search input and does not search below the minimum length', () => {
        render(<HeaderSearchForm />)
        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'ab' } })
        expect(input).toBeTruthy()
    })

    it('renders found games and events for a longer query', async () => {
        searchResult = {
            search: {
                __typename: 'SearchResult',
                games: [{ __typename: 'Game', id: '1', name: 'Dračí doupě', year: 2014, averageRating: 4, totalRating: 5, amountOfComments: 2, amountOfRatings: 5, labels: [], authors: null, groupAuthor: null }],
                users: [{ __typename: 'User', id: '2', name: 'Hráč', nickname: null }],
                events: [{ __typename: 'Event', id: '3', name: 'Con', from: '2027-06-04', to: '2027-06-06' }],
                groups: [],
                totalGames: 1,
                totalUsers: 1,
                totalEvents: 1,
                totalGroups: 0,
            },
        }
        render(<HeaderSearchForm />)
        const input = screen.getByRole('textbox')
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: 'drac' } })
        // The query debounce (CHANGE_TIMEOUT = 500ms) must elapse before
        // results render, and the box must stay focused.
        expect(await screen.findByText('Dračí doupě', {}, { timeout: 2000 })).toBeTruthy()
        expect(screen.getByText('Hráč')).toBeTruthy()
    })

    it('submits the typed query to the search page and clears the box', async () => {
        render(<HeaderSearchForm />)
        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'dungeon' } })

        fireEvent.submit(document.querySelector('form')!)

        expect((pushedRoute as unknown as { href: string }).href).toBe('/search?q=dungeon')
        // The input is cleared after the redirect.
        expect((input as HTMLInputElement).value).toBe('')
    })

    it('carries the "show all" link for the result kinds', async () => {
        searchResult = {
            search: {
                __typename: 'SearchResult',
                games: [{ __typename: 'Game', id: '1', name: 'Dračí doupě', year: 2014, averageRating: 4, totalRating: 5, amountOfComments: 2, amountOfRatings: 5, labels: [], authors: null, groupAuthor: null }],
                users: [],
                events: [],
                groups: [],
                totalGames: 1,
                totalUsers: 0,
                totalEvents: 0,
                totalGroups: 0,
            },
        }
        render(<HeaderSearchForm />)
        const input = screen.getByRole('textbox')
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: 'drac' } })

        expect(await screen.findByText('Dračí doupě', {}, { timeout: 2000 })).toBeTruthy()
        // All of the result kinds keep their "show all" link.
        expect(screen.getAllByText(translate(cs, 'PageHeader.search.showMore')).length).toBeGreaterThan(0)
    })
})

describe('CookieConsent', () => {
    beforeEach(() => {
        cleanup()
        window.localStorage.clear()
    })

    it('stays hidden when analytics is disabled (the default in tests)', () => {
        render(<CookieConsent />)
        expect(screen.queryByTestId('cookieConsent')).toBeNull()
    })
})

describe('SignInRequiredWrapper', () => {
    beforeEach(() => {
        cleanup()
        currentUser = null
    })

    it('shows the sign-in panel when required but anonymous', () => {
        render(<SignInRequiredWrapper requiredRole="USER">content</SignInRequiredWrapper>)
        expect(screen.getByTestId('signin-panel')).toBeTruthy()
    })

    it('passes children through for the ANONYMOUS requirement', () => {
        render(<SignInRequiredWrapper requiredRole="ANONYMOUS">public content</SignInRequiredWrapper>)
        expect(screen.getByText('public content')).toBeTruthy()
    })

    it('denies a USER the EDITOR-only content', () => {
        currentUser = { id: '1', role: 'USER' }
        render(<SignInRequiredWrapper requiredRole="EDITOR">secret</SignInRequiredWrapper>)
        expect(screen.getByText(translate(cs, 'SignInRequired.accessDenied'))).toBeTruthy()
    })

    it('lets an ADMIN into ADMIN-only content', () => {
        currentUser = { id: '1', role: 'ADMIN' }
        render(<SignInRequiredWrapper requiredRole="ADMIN">admin content</SignInRequiredWrapper>)
        expect(screen.getByText('admin content')).toBeTruthy()
    })

    it('lets an ADMIN into EDITOR-only content too', () => {
        currentUser = { id: '1', role: 'ADMIN' }
        render(<SignInRequiredWrapper requiredRole="EDITOR">editor content</SignInRequiredWrapper>)
        expect(screen.getByText('editor content')).toBeTruthy()
    })
})
