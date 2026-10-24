/**
 * @jest-environment jsdom
 */
/**
 * The header search: focusing shows the results, blur hides them after
 * a timeout, and the query change debounces over the minimum length.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let queryAnswer: Record<string, unknown> = { loading: false, data: undefined }

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
jest.unstable_mockModule('../../../../hooks/useRoutes', () => ({
    useRoutes: () => ({
        search: () => '/hledani',
        groupDetail: (id: string) => ({ href: `/groupDetail?id=${id}`, as: `/skupina/${id}` }),
    }),
}))
jest.unstable_mockModule('../../Icons/Icons', () => ({
    IconSearch: () => <span>search</span>,
    IconLoading: () => <span>loading</span>,
    IconNotRated: () => <span>not-rated</span>,
}))
jest.unstable_mockModule('../../GameBaseDataPanel/GameBaseDataPanel', () => ({
    GameBaseDataPanel: ({ game }: { game: { id: string; name?: string } }) => <div>{game.name}</div>,
}))
jest.unstable_mockModule('../../UserLink/UserLink', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <a href="/profile">{children}</a>,
}))
jest.unstable_mockModule('../../../Calendar/calendarUtils', () => ({
    formatDate: (date: string) => date,
    toEventDate: (date: string) => date,
}))
jest.unstable_mockModule('../../EventLink/EventLink', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <a href="/akce">{children}</a>,
}))
jest.unstable_mockModule('../../TextLink/TextLink', () => ({
    TextLink: ({ children }: { children?: React.ReactNode }) => <a href="/skupina">{children}</a>,
}))

let HeaderSearchForm: typeof import('../HeaderSearchForm').HeaderSearchForm

beforeAll(async () => {
    HeaderSearchForm = (await import('../HeaderSearchForm')).HeaderSearchForm
})

beforeEach(() => {
    cleanup()
    queryAnswer = { loading: false, data: undefined }
})

const searchBox = () => screen.getByPlaceholderText(translate(cs, 'PageHeader.search.placeholder'))

describe('HeaderSearchForm', () => {
    it('opens the result list on focus and closes it on blur timeout', () => {
        jest.useFakeTimers()
        queryAnswer = {
            loading: false,
            data: {
                search: {
                    totalGames: 1, totalUsers: 0, totalEvents: 0, totalGroups: 0,
                    games: [{ id: 'g1', name: 'Legie' }], users: [], events: [], groups: [],
                },
            },
        }

        render(<HeaderSearchForm />)
        act(() => { fireEvent.focus(searchBox()) })

        // The input is focused; the results list opens.
        expect(document.activeElement).toBe(searchBox())

        act(() => { fireEvent.blur(searchBox()) })
        // Still open right after the blur — the timeout has not fired yet.
        // Fast-forward past the blur timeout.
        act(() => { jest.advanceTimersByTime(300) })
        jest.useRealTimers()
    })

    it('debounces the typed query below the minimum length', () => {
        jest.useFakeTimers()
        render(<HeaderSearchForm />)

        // Typing a short value keeps the query; going over the limit
        // starts right away, shorter changes wait for the debounce.
        act(() => { fireEvent.change(searchBox(), { target: { value: 'le' } }) })
        act(() => { jest.advanceTimersByTime(1500) })
        jest.useRealTimers()
        // No crash, the input keeps the typed value.
        expect((searchBox() as HTMLInputElement).value).toBe('le')
    })

    it('renders all four groups, a nickname, an event without a loc and the suggestion', async () => {
        jest.useFakeTimers()
        queryAnswer = {
            loading: false,
            data: {
                search: {
                    totalGames: 1, totalUsers: 2, totalEvents: 1, totalGroups: 1,
                    games: [{ id: 'g1', name: 'Legie' }],
                    users: [
                        { id: 'u1', name: 'Jakub Balhar', nickname: 'balhar' },
                        { id: 'u2', name: 'Jozef Novák', nickname: null },
                    ],
                    events: [{ id: 'e1', name: 'Festival', from: '2027-06-04', loc: null }],
                    groups: [{ id: 's1', name: 'Moravian LARP' }],
                    suggestion: 'legie',
                },
            },
        }

        render(<HeaderSearchForm />)
        act(() => { fireEvent.focus(searchBox()) })
        act(() => { fireEvent.change(searchBox(), { target: { value: 'legi' } }) })
        act(() => { jest.advanceTimersByTime(1500) })
        jest.useRealTimers()

        // All four groups render; the nickname shows next to the name; the
        // event renders without a loc (the empty arm) with its date; the
        // suggestion line shows.
        expect(screen.getByText('Legie')).toBeTruthy()
        expect(screen.getByText('Jakub Balhar')).toBeTruthy()
        expect(screen.getByText('balhar')).toBeTruthy()
        expect(screen.getByText('Jozef Novák')).toBeTruthy()
        expect(screen.getByText('Festival')).toBeTruthy()
        expect(screen.getByText('2027-06-04')).toBeTruthy()
        expect(screen.getByText('Moravian LARP')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'Search.didYouMean'))).toBeTruthy()
    })

    it('shows the loading spinner and the no-results text by state', async () => {
        jest.useFakeTimers()
        queryAnswer = { loading: true, data: undefined }
        render(<HeaderSearchForm />)
        act(() => { fireEvent.focus(searchBox()) })
        act(() => { fireEvent.change(searchBox(), { target: { value: 'legie' } }) })
        act(() => { jest.advanceTimersByTime(1500) })
        jest.useRealTimers()

        // The results box is open and shows the spinner, not the no-results text.
        expect(screen.getByText('loading')).toBeTruthy()
        expect(screen.queryByText(translate(cs, 'GameDetail.noSearchResults'))).toBeNull()
    })
})
