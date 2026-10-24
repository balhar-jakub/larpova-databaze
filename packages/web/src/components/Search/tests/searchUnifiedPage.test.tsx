/**
 * @jest-environment jsdom
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The search page shows one query and four kinds of result on one page. What the
 * page has to get right — and what a visitor to the old tabbed version could not
 * see — is: the count of every kind on its chip before anything is clicked, the
 * best three rows of every kind opening the page (interleaved, so the ranking of
 * a kind with 153 rows cannot push the other three off the screen), the rest of
 * every kind behind a bar that says how many it holds, and the picked kind in the
 * URL as `typ=`, not `t=`.
 *
 * The four panels and the rows are stubbed: their own rules are tested where they
 * live, this pins the wiring of the page.
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
) as Record<string, unknown>

/** The answer the mocked `useQuery` gives; every test sets it. */
let queryAnswer: Record<string, unknown> = { loading: false }
const replaceSpy = jest.fn()

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => queryAnswer,
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ pathname: '/search', query: {}, replace: replaceSpy }),
}))
// The real hook returns a ref that keeps its identity across renders — a mock
// handing back a fresh object each render would re-run the panel's "props
// changed" effect on every render and undo every click.
const formRef = { current: null }

jest.unstable_mockModule('src/hooks/useFocusInput', () => ({
    useFocusInput: () => formRef,
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div /> }))
jest.unstable_mockModule('../SearchSuggestion', () => ({
    default: ({ suggestion, onUse }: { suggestion?: string | null; onUse: (value: string) => void }) =>
        suggestion ? <button type="button" onClick={() => onUse(suggestion)}>{suggestion}</button> : null,
}))

// The four lists themselves are not under test here — only that the page picks
// the right one, so each stub shouts which panel got rendered.
jest.unstable_mockModule('../GamesSearchPanel', () => ({
    default: ({ onStateChange, onReset }: { onStateChange: (patch: Record<string, unknown>) => void; onReset: () => void }) => (
        <div data-testid="panel-games">
            <button type="button" data-testid="panel-games-change" onClick={() => onStateChange({ labels: ['1'], yearFrom: 2015 })} />
            <button type="button" data-testid="panel-games-query" onClick={() => onStateChange({ query: 'novy-dotaz' })} />
            <button type="button" data-testid="panel-games-reset" onClick={onReset} />
        </div>
    ),
}))
jest.unstable_mockModule('../UserSearchPanel', () => ({ default: () => <div data-testid="panel-users" /> }))
jest.unstable_mockModule('../EventsSearchPanel', () => ({ default: () => <div data-testid="panel-events" /> }))
jest.unstable_mockModule('../GroupsSearchPanel', () => ({ default: () => <div data-testid="panel-groups" /> }))

jest.unstable_mockModule('../SearchGameRow', () => ({
    default: ({ game }: { game: { id: string } }) => <div data-testid={`row-games-${game.id}`} />,
}))
jest.unstable_mockModule('../SearchPersonRow', () => ({
    default: ({ person }: { person: { id: string } }) => <div data-testid={`row-users-${person.id}`} />,
}))
jest.unstable_mockModule('../SearchEventRow', () => ({
    default: ({ event }: { event: { id: string } }) => <div data-testid={`row-events-${event.id}`} />,
}))
jest.unstable_mockModule('../SearchGroupRow', () => ({
    default: ({ group }: { group: { id: string } }) => <div data-testid={`row-groups-${group.id}`} />,
}))

// The panel loads its document with require(); ESM jest has no require.
;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let SearchPanel: typeof import('../SearchPanel').default

beforeAll(async () => {
    SearchPanel = (await import('../SearchPanel')).default
})

beforeEach(() => {
    replaceSpy.mockClear()
    queryAnswer = { loading: false, data: overviewAnswer() }
})

const game = (id: string) => ({ id, name: `Hra ${id}` })
const person = (id: string) => ({ id, name: `Člověk ${id}` })
const event = (id: string) => ({ id, name: `Událost ${id}` })
const group = (id: string) => ({ id, name: `Skupina ${id}` })

const overviewAnswer = (patch: Record<string, unknown> = {}) => ({
    search: {
        totalGames: 121,
        totalUsers: 7,
        totalEvents: 153,
        totalGroups: 7,
        suggestion: null,
        games: [game('1'), game('2'), game('3')],
        users: [person('1'), person('2'), person('3')],
        events: [event('1'), event('2'), event('3')],
        groups: [group('1'), group('2'), group('3')],
        ...patch,
    },
})

const renderPanel = (props: { initialQuery?: string; initialType?: string } = {}) =>
    render(<SearchPanel initialQuery="larp" {...props} />)

const chip = (type: string) => screen.getByTestId(`search.typeChip.${type}`)
const bar = (type: string) => screen.getByTestId(`search.sectionBar.${type}`)

describe('the search page counts every kind before anything is clicked', () => {
    test('each chip carries the number of results of its kind', () => {
        renderPanel()

        expect(chip('all').textContent).toContain('288')
        expect(chip('games').textContent).toContain('121')
        expect(chip('users').textContent).toContain('7')
        expect(chip('events').textContent).toContain('153')
        expect(chip('groups').textContent).toContain('7')
    })

    test('the best three of every kind open the page, interleaved by rank', () => {
        const { container } = renderPanel()

        const rows = Array.from(container.querySelectorAll('[data-testid^="row-"]')).map(el =>
            el.getAttribute('data-testid'),
        )

        expect(rows).toEqual([
            'row-games-1',
            'row-users-1',
            'row-events-1',
            'row-groups-1',
            'row-games-2',
            'row-users-2',
            'row-events-2',
            'row-groups-2',
            'row-games-3',
            'row-users-3',
            'row-events-3',
            'row-groups-3',
        ])
    })

    test('the rest of every kind is collapsed behind a bar that names its size', () => {
        renderPanel()

        expect(bar('games').textContent).toContain('121')
        expect(bar('games').textContent).toContain('zobrazit všech 121')
        expect(bar('events').textContent).toContain('zobrazit všech 153')
        // The bar says how many of them the block above already shows.
        expect(bar('games').textContent).toContain('3')
    })

    test('a kind with nothing behind it says so and does not offer a dead link', () => {
        queryAnswer = { loading: false, data: overviewAnswer({ totalUsers: 0, users: [] }) }
        renderPanel()

        expect(bar('users').textContent).toContain('tomuto typu nic neodpovídá')
        // "zobrazit všech 0" is a link to nothing.
        expect(screen.queryByTestId('search.showAll.users')).toBeNull()
        expect(screen.getByTestId('search.showAll.games')).toBeTruthy()
    })
})

describe('picking a kind narrows the page and lands in the URL', () => {
    test('the games chip opens the games list in place and writes typ=hry', () => {
        renderPanel()
        fireEvent.click(chip('games'))

        expect(screen.getByTestId('panel-games')).toBeTruthy()
        expect(screen.queryByTestId('search.sectionBar.events')).toBeNull()
        expect(replaceSpy).toHaveBeenCalledWith(
            { pathname: '/search', query: { q: 'larp', typ: 'hry' } },
            undefined,
            { shallow: true },
        )
    })

    test('the events chip opens the events list and writes typ=udalosti', () => {
        renderPanel()
        fireEvent.click(chip('events'))

        expect(screen.getByTestId('panel-events')).toBeTruthy()
        expect(replaceSpy).toHaveBeenCalledWith(
            { pathname: '/search', query: { q: 'larp', typ: 'udalosti' } },
            undefined,
            { shallow: true },
        )
    })

    test('the link with typ=lide opens the people list', () => {
        renderPanel({ initialType: 'lide' })

        expect(screen.getByTestId('panel-users')).toBeTruthy()
        expect(screen.queryByTestId('search.sectionBar.games')).toBeNull()
    })

    test('the old t=users link still opens the people list', () => {
        renderPanel({ initialType: 'users' })

        expect(screen.getByTestId('panel-users')).toBeTruthy()
    })

    test('a kind with no result offers the kinds that have one', () => {
        queryAnswer = { loading: false, data: overviewAnswer({ totalUsers: 0, users: [] }) }
        renderPanel({ initialType: 'lide' })

        expect(screen.getByTestId('search.emptyType.users').textContent).toContain('Tomuto typu dotaz neodpovídá')
        expect(screen.getByTestId('search.emptyLink.games').textContent).toContain('121')
        expect(screen.getByTestId('search.emptyLink.events').textContent).toContain('153')
    })

    test('coming back from a kind restores the whole page', () => {
        renderPanel({ initialType: 'lide' })
        fireEvent.click(screen.getByTestId('search.collapse.users'))

        expect(bar('games')).toBeTruthy()
        expect(replaceSpy).toHaveBeenCalledWith({ pathname: '/search', query: { q: 'larp' } }, undefined, {
            shallow: true,
        })
    })
})

describe('the page says what it was asked', () => {
    test('the query is shown and can be cleared', () => {
        renderPanel()

        expect(screen.getByTestId('search.panel').textContent).toContain('Výsledky pro')
        fireEvent.click(screen.getByTestId('search.clearQuery'))
        expect(replaceSpy).toHaveBeenCalledWith({ pathname: '/search', query: {} }, undefined, { shallow: true })
    })

    test('submitting the form updates the query in the URL', () => {
        renderPanel()

        const input = screen.getByPlaceholderText(translate(cs, 'Search.query'))
        fireEvent.change(input, { target: { value: '  legie  ' } })
        fireEvent.submit(input.closest('form')!)

        // The query is trimmed before it lands in the URL.
        expect(replaceSpy).toHaveBeenCalledWith(
            { pathname: '/search', query: { q: 'legie' } },
            undefined,
            { shallow: true },
        )
    })

    test('the did-you-mean suggestion becomes the query', async () => {
        queryAnswer = {
            loading: false,
            data: overviewAnswer({
                suggestion: 'legii',
                totalGames: 0, totalUsers: 0, totalEvents: 0, totalGroups: 0,
                games: [], users: [], events: [], groups: [],
            }),
        }

        renderPanel()

        const suggestion = await screen.findByText('legii', { selector: 'button' })
        fireEvent.click(suggestion)
        expect(replaceSpy).toHaveBeenCalledWith(
            { pathname: '/search', query: { q: 'legii' } },
            undefined,
            { shallow: true },
        )
    })

    test('nothing was found at all', () => {
        queryAnswer = {
            loading: false,
            data: overviewAnswer({ totalGames: 0, totalUsers: 0, totalEvents: 0, totalGroups: 0, games: [], users: [], events: [], groups: [] }),
        }
        renderPanel()

        expect(screen.getByTestId('search.empty').textContent).toContain('Dotazu nic nevyhovuje')
        expect(chip('all').textContent).toContain('0')
    })

    test('a one letter query searches nothing yet', () => {
        renderPanel({ initialQuery: 'l' })

        expect(screen.getByTestId('search.tooShort')).toBeTruthy()
        expect(screen.queryByTestId('search.typeChip.all')).toBeNull()
    })
})

// The games tab's filter panel is wired to the page: filter changes and
// the reset land in the URL together with the query, and a query change
// coming from the panel rewrites the page's own query.
describe('the games panel is wired to the page state', () => {
    test('a filter change lands in the URL with the query', () => {
        renderPanel({ initialQuery: 'dotaz', initialType: 'hry' })

        fireEvent.click(screen.getByTestId('panel-games-change'))

        expect(replaceSpy).toHaveBeenCalled()
        const last = ((replaceSpy.mock.calls.at(-1)?.[0] as { query?: Record<string, string> })?.query) ?? {}
        expect(last.q).toBe('dotaz')
        expect(last.yf).toBe('2015')
        expect(last.labels).toBe('1')
    })

    test('a query change from the panel rewrites the page query', () => {
        renderPanel({ initialQuery: 'dotaz', initialType: 'hry' })

        fireEvent.click(screen.getByTestId('panel-games-query'))

        expect(screen.getByTestId('search.panel').textContent).toContain('novy-dotaz')
        const last = ((replaceSpy.mock.calls.at(-1)?.[0] as { query?: Record<string, string> })?.query) ?? {}
        expect(last.q).toBe('novy-dotaz')
    })

    test('the reset clears the catalog filters but keeps the query', () => {
        renderPanel({ initialQuery: 'dotaz', initialType: 'hry' })

        fireEvent.click(screen.getByTestId('panel-games-reset'))

        const last = ((replaceSpy.mock.calls.at(-1)?.[0] as { query?: Record<string, string> })?.query) ?? {}
        expect(last.q).toBe('dotaz')
        expect(last.labels).toBeUndefined()
        expect(last.yf).toBeUndefined()
    })
})

describe('branch arms of the page', () => {
    test('a query with no answer yet shows the loading block and no summary', () => {
        // Asked but the data has not landed: overview undefined.
        queryAnswer = { loading: true, data: undefined }
        renderPanel()

        // The loading arm rendered BigLoading (mocked as an empty div): the
        // summary line with "Výsledky pro" must NOT be there.
        expect(screen.getByTestId('search.panel').textContent).not.toContain('Výsledky pro')
    })

    test('a partial overview answers zero for its missing kinds', () => {
        // The ?? 0 arms: the server answered only the game counts.
        queryAnswer = {
            loading: false,
            data: {
                search: {
                    totalGames: 5,
                    games: [game('1')],
                    totalUsers: undefined,
                    users: [],
                    totalEvents: null,
                    events: [],
                    totalGroups: 0,
                    groups: [],
                    suggestion: null,
                },
            },
        }
        renderPanel()

        expect(chip('games').textContent).toContain('5')
        // Every missing count renders as 0, not NaN or a blank.
        expect(chip('users').textContent).toContain('0')
        expect(chip('events').textContent).toContain('0')
        expect(chip('groups').textContent).toContain('0')
    })

    test('an empty initialQuery renders the enter-query notice, not results', () => {
        renderPanel({ initialQuery: '' })

        expect(screen.getByText(translate(cs, 'Search.enterQuery'))).toBeTruthy()
        expect(screen.queryByTestId('search.clearQuery')).toBeNull()
    })
})
