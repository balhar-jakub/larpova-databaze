/**
 * @jest-environment jsdom
 */
/**
 * The people and groups tabs of the unified search: result rows, heading
 * counts, empty state, and offset paging.
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

let usersPage: { users: unknown[]; totalAmount: number } | undefined
let groupsPage: { groups: unknown[]; totalAmount: number } | undefined
const queryVariables: Array<Record<string, unknown>> = []
const suggestionsUsed: string[] = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
const seenKeys = new Set<string>()
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: (gql: unknown, opts: { variables?: Record<string, unknown>; onCompleted?: (d: unknown) => void }) => {
        queryVariables.push(opts.variables ?? {})
        // Fire onCompleted once per unique variables set (like a real fetch).
        const key = JSON.stringify(opts.variables ?? {})
        if (!seenKeys.has(key)) {
            seenKeys.add(key)
            Promise.resolve().then(() => {
                opts.onCompleted?.({ groupsByQuery: groupsPage?.groups ?? [] })
            })
        }
        return { loading: false, data: { usersByQueryWithTotal: usersPage } }
    },
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../common/Pager/Pager', () => ({
    default: ({ currentOffset, pageSize, totalAmount, onOffsetChanged }: { currentOffset: number; pageSize: number; totalAmount: number; onOffsetChanged: (o: number) => void }) => (
        <div data-testid="pager" data-offset={String(currentOffset)} data-total={String(totalAmount)}>
            <button type="button" onClick={() => onOffsetChanged(pageSize)}>next</button>
        </div>
    ),
}))
jest.unstable_mockModule('../SearchSuggestion', () => ({
    default: ({ suggestion, onUse }: { suggestion?: string | null; onUse: (s: string) => void }) => (
        <button type="button" onClick={() => onUse(suggestion ?? 'navrh')}>use-suggestion</button>
    ),
}))
jest.unstable_mockModule('../SearchPersonRow', () => ({
    default: ({ person }: { person: { id: string; name?: string | null } }) => <div data-testid={`user-row-${person.id}`}>{person.name}</div>,
}))
jest.unstable_mockModule('../SearchGroupRow', () => ({
    default: ({ group }: { group: { id: string; name?: string | null } }) => <div data-testid={`group-row-${group.id}`}>{group.name}</div>,
}))

let UserSearchPanel: typeof import('../UserSearchPanel')['default']
let GroupsSearchPanel: typeof import('../GroupsSearchPanel')['default']

beforeAll(async () => {
    UserSearchPanel = (await import('../UserSearchPanel')).default
    GroupsSearchPanel = (await import('../GroupsSearchPanel')).default
})

beforeEach(() => {
    cleanup()
    seenKeys.clear()
    queryVariables.length = 0
    suggestionsUsed.length = 0
    usersPage = {
        users: [
            { __typename: 'User', id: 'u1', name: 'Jakub', nickname: 'Balda' },
            { __typename: 'User', id: 'u2', name: 'Jana', nickname: null },
        ],
        totalAmount: 31,
    }
    groupsPage = {
        groups: [{ __typename: 'Group', id: 'gr1', name: 'Klub Dračí doupě' }],
        totalAmount: 12,
    }
})

describe('UserSearchPanel', () => {
    it('renders the user rows, the count heading and the pager', () => {
        render(<UserSearchPanel query="jak" onUseSuggestion={(s) => suggestionsUsed.push(s)} />)

        expect(screen.getByTestId('user-row-u1')).toBeTruthy()
        expect(screen.getByTestId('user-row-u2')).toBeTruthy()
        expect(screen.getByTestId('pager').dataset.total).toBe('31')
        expect(screen.getByText(translate(cs, 'Search.resultCountUsers', { count: 31 }))).toBeTruthy()
    })

    it('shows the empty heading and suggestion for no results', () => {
        usersPage = { users: [], totalAmount: 0 }
        render(<UserSearchPanel query="neznamy" onUseSuggestion={(s) => suggestionsUsed.push(s)} />)

        expect(screen.getByText(translate(cs, 'Search.notFound'))).toBeTruthy()
        fireEvent.click(screen.getByText('use-suggestion'))
        expect(suggestionsUsed).toEqual(['navrh'])
    })

    it('pages by offset', async () => {
        render(<UserSearchPanel query="jak" onUseSuggestion={(s) => suggestionsUsed.push(s)} />)

        fireEvent.click(screen.getByText('next'))
        await waitFor(() => expect(screen.getByTestId('pager').dataset.offset).toBe('24'))
    })
})

describe('GroupsSearchPanel', () => {
    it('renders the group rows after the query completes', async () => {
        render(<GroupsSearchPanel query="klub" totalAmount={12} />)

        await waitFor(() => expect(screen.getByTestId('group-row-gr1')).toBeTruthy())
        expect(screen.getByText(translate(cs, 'Search.resultCountGroups', { count: 12 }))).toBeTruthy()
    })

    it('shows the not-found heading for empty groups', async () => {
        groupsPage = { groups: [], totalAmount: 0 }
        render(<GroupsSearchPanel query="nic" totalAmount={0} />)

        await waitFor(() => expect(screen.getByText(translate(cs, 'Search.notFound'))).toBeTruthy())
    })

    it('appends the next page with the load-more button', async () => {
        // First page: one group; total 2 => the more button appears.
        groupsPage = { groups: [{ __typename: 'Group', id: 'gr1', name: 'První' }], totalAmount: 2 }
        render(<GroupsSearchPanel query="klub" totalAmount={2} />)
        await waitFor(() => expect(screen.getByTestId('group-row-gr1')).toBeTruthy())

        // Next page returns the second group; clicking appends it.
        groupsPage = { groups: [{ __typename: 'Group', id: 'gr2', name: 'Druhá' }], totalAmount: 2 }
        const more = screen.getByTestId('catalog.loadMore')
        fireEvent.click(more)
        await waitFor(() => expect(screen.getByTestId('group-row-gr2')).toBeTruthy())
    })
})
