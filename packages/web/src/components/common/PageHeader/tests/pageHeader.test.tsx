/**
 * @jest-environment jsdom
 */
/**
 * The page header navigation: brand link, nav links, the mobile menu
 * toggle, and the document title default.
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})


jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: undefined, loading: false }),
    useMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
    useApolloClient: () => ({}),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: () => undefined, pathname: '/', query: {} }),
    Router: { push: () => undefined, events: { on: () => undefined, off: () => undefined } },
}))
jest.unstable_mockModule('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactNode }) => (
        <a href={typeof href === 'string' ? href : '/'}>{children}</a>
    ),
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = {
            games: () => '/hry',
            calendar: () => '/kalendar',
            statistics: () => '/statistiky',
            eventCreate: () => '/pridat-udalost',
            gameCreate: () => ({ href: '/pridat-hru', as: '/pridat-hru' }),
            search: () => ({ href: '/hledani', as: '/hledani' }),
            homepage: () => '/',
            signIn: () => '/prihlaseni',
            signUp: () => '/registrace',
            currentProfile: () => '/muj-profil',
            userSettings: () => '/nastaveni',
            changePassword: () => '/zmena-hesla',
            adminIntro: () => '/admin',
        }
        return { ...routes, push: () => undefined }
    },
}))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({ useLoggedInUser: () => undefined }))
jest.unstable_mockModule('src/hooks/useHideInPlaceLogin', () => ({
    useHideInPlaceLogin: () => () => undefined,
}))
jest.unstable_mockModule('src/context/UserContext/UserContext', () => ({
    UserContext: { _currentValue: undefined, Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> },
}))
jest.unstable_mockModule('src/context/InPlaceSignInContext/InPlaceSignInContext', () => ({
    InPlaceSignInContext: { _currentValue: { value: false, setValue: () => undefined }, Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> },
}))
jest.unstable_mockModule('../HeaderNavLink', () => ({
    HeaderNavLink: ({ route, target, children }: { route: unknown; target?: string; children: React.ReactNode }) => (
        <a href={typeof route === 'string' ? route : (route as { as: string }).as} target={target}>{children}</a>
    ),
    headerLinkStyle: {},
    headerLinkStyleMd: {},
}))
jest.unstable_mockModule('../../WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../HeaderSearchForm', () => ({
    HeaderSearchForm: () => <div data-testid="header-search" />,
}))
jest.unstable_mockModule('../HeaderUser', () => ({
    default: () => <div data-testid="header-user" />,
}))
jest.unstable_mockModule('../../Icons/Icons', () => ({
    IconMenu: () => <svg data-testid="icon-menu" />,
    IconClose: () => <svg data-testid="icon-close" />,
}))
jest.unstable_mockModule('../../GameBaseDataPanel/GameBaseDataPanel', () => ({ default: () => <div /> }))
jest.unstable_mockModule('../../UserLink/UserLink', () => ({ default: () => <a href="/profil">user</a> }))
jest.unstable_mockModule('../../TextLink/TextLink', () => ({ default: () => <a href="/">text</a> }))
jest.unstable_mockModule('../../EventLink/EventLink', () => ({ default: () => <a href="/udalost">event</a> }))
jest.unstable_mockModule('../../FormPageRow/FormPageRow', () => ({ default: () => <div /> }))
jest.unstable_mockModule('../../BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../../SignIn/SignInPanel', () => ({ default: () => <div /> }))
jest.unstable_mockModule('../../ProfileImage/ProfileImage', () => ({ DEFAULT_IMAGE_URL: '/default.png' }))

let PageHeader: typeof import('../PageHeader')['PageHeader']

beforeAll(async () => {
    PageHeader = (await import('../PageHeader')).PageHeader
})

beforeEach(() => {
    cleanup()
})

describe('PageHeader', () => {
    it('renders the brand, nav links, search and user parts', () => {
        render(<PageHeader />)

        expect(screen.getByAltText(translate(cs, 'PageHeader.csld'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'PageHeader.games'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'PageHeader.calendar'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'PageHeader.statistics'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'PageHeader.blog'))).toBeTruthy()
        expect(screen.getByTestId('header-search')).toBeTruthy()
        expect(screen.getByTestId('header-user')).toBeTruthy()
    })

    it('defaults the document title to the site name', async () => {
        document.title = ''
        render(<PageHeader />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(document.title).toBe(translate(cs, 'PageHeader.csld'))
    })

    it('expands the nav links when the menu button is clicked', () => {
        render(<PageHeader />)

        // The links part carries the responsive hide class when collapsed.
        const linksPart = screen.getByText(translate(cs, 'PageHeader.games')).closest('div')!
        expect(linksPart.className).toContain('d-none')
        fireEvent.click(screen.getByTestId('icon-menu').closest('button')!)
        expect(linksPart.className).not.toContain('d-none')
    })
})
