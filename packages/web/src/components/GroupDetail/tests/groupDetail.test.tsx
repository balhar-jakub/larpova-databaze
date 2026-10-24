/**
 * @jest-environment jsdom
 */
/**
 * The group detail cluster: the panel (group header, authors-of list,
 * editor-only create/edit actions, save toast + refetch) and the edit
 * modal (create vs update mutations, required name).
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

let queryData: Record<string, unknown> | undefined
let loggedInUser: { id: string; role?: string } | undefined | null = null
const mutationCalls: Array<{ variables?: Record<string, unknown> }> = []
const toasts: Array<{ text: string; type: string }> = []
let refetchCalls = 0
let pushedRoute = ''

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: queryData, loading: false, refetch: () => { refetchCalls += 1; return Promise.resolve() } }),
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        mutationCalls.push(opts)
        return Promise.resolve({ data: { group: { createGroup: { id: 'new-g' }, updateGroup: { id: 'g1' } } } })
    }, { loading: false }],
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({ useLoggedInUser: () => loggedInUser }))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({ useFocusInput: () => ({ current: null }) }))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = { groupDetail: (id: string) => ({ href: `/groupDetail?id=${id}`, as: `/group/${id}` }) }
        return { ...routes, push: (r: { as: string }) => { pushedRoute = r.as } }
    },
}))
jest.unstable_mockModule('src/utils/roleUtils', () => ({ isAtLeastEditor: (role?: string) => role === 'EDITOR' || role === 'ADMIN' }))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/DetailGameList/DetailGameList', () => ({
    default: ({ games }: { games: Array<{ id: string; name?: string | null }> }) => (
        <div data-testid="game-list">{games.map((g) => g.name).join(', ')}</div>
    ),
}))
jest.unstable_mockModule('../../common/ActionButton/ActionButton', () => ({
    default: ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
        <button type="button" onClick={onClick}>{children}</button>
    ),
}))
// GroupEditModal stays REAL: the panel tests drive its actual save/cancel
// buttons (Uložit/Storno), and the modal describe below tests it directly.

let GroupDetailPanel: typeof import('../GroupDetailPanel')['default']
let GroupEditModal: typeof import('../GroupEditModal')['default']

beforeAll(async () => {
    GroupDetailPanel = (await import('../GroupDetailPanel')).default
    GroupEditModal = (await import('../GroupEditModal')).default
})
// (the import above happens before the unstable_mockModule calls in this file
// are registered? No - hoisted mocks apply to it; the modal tests use the
// real module by importing via a separate specifier at the top.)

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    refetchCalls = 0
    pushedRoute = ''
    loggedInUser = null
    queryData = {
        groupById: {
            __typename: 'Group',
            id: 'g1',
            name: 'Klub Dračí doupě',
            authorsOf: [
                { __typename: 'Game', id: 'ga1', name: 'Hra první' },
                { __typename: 'Game', id: 'ga2', name: 'Hra druhá' },
            ],
        },
    }
})

describe('GroupDetailPanel', () => {
    it('renders the group name, the authors-of count and the game list', () => {
        render(<GroupDetailPanel groupId="g1" />)

        expect(screen.getByText('Klub Dračí doupě')).toBeTruthy()
        expect(screen.getByTestId('game-list').textContent).toBe('Hra první, Hra druhá')
        expect(screen.getByText(translate(cs, 'GroupDetail.authorsOf', { count: 2 }))).toBeTruthy()
    })

    it('hides the create/edit actions from plain users', () => {
        loggedInUser = { id: 'u1', role: 'USER' }
        render(<GroupDetailPanel groupId="g1" />)

        expect(screen.queryByRole('button', { name: (t) => t.includes(translate(cs, 'GroupDetail.createGroup')) })).toBeNull()
    })

    it('shows both actions for editors and opens the modals', async () => {
        loggedInUser = { id: 'u1', role: 'EDITOR' }
        render(<GroupDetailPanel groupId="g1" />)

        fireEvent.click(screen.getByRole('button', { name: (t) => t.includes(translate(cs, 'GroupDetail.createGroup')) }))
        await waitFor(() => expect(screen.getByPlaceholderText(translate(cs, 'GroupEditModal.name'))).toBeTruthy())

        // Creating navigates to the new group's detail page (no refetch/toast).
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'GroupEditModal.name')), { target: { value: 'Nová skupina' } })
        fireEvent.click(screen.getByText(translate(cs, 'GroupEditModal.save')))
        await waitFor(() => expect(pushedRoute).toBe('/group/new-g'))
    })

    it('toasts the update wording when the edit modal is saved', async () => {
        loggedInUser = { id: 'u1', role: 'EDITOR' }
        render(<GroupDetailPanel groupId="g1" />)

        fireEvent.click(screen.getByRole('button', { name: (t) => t.includes(translate(cs, 'GroupDetail.editGroup')) }))
        await waitFor(() => expect(screen.getByPlaceholderText(translate(cs, 'GroupEditModal.name'))).toBeTruthy())
        fireEvent.click(screen.getByText(translate(cs, 'GroupEditModal.save')))
        await waitFor(() => expect(toasts[0]?.text).toBe(translate(cs, 'GroupDetail.groupUpdated')))
    })

    it('closes the modal without a toast when nothing was saved', async () => {
        loggedInUser = { id: 'u1', role: 'EDITOR' }
        render(<GroupDetailPanel groupId="g1" />)

        fireEvent.click(screen.getByRole('button', { name: (t) => t.includes(translate(cs, 'GroupDetail.createGroup')) }))
        await waitFor(() => expect(screen.getByPlaceholderText(translate(cs, 'GroupEditModal.name'))).toBeTruthy())
        fireEvent.click(screen.getByText(translate(cs, 'GroupEditModal.cancel')))
        await waitFor(() => expect(screen.queryByPlaceholderText(translate(cs, 'GroupEditModal.name'))).toBeNull())
        expect(toasts.length).toBe(0)
    })
})

describe('GroupEditModal', () => {
    it('creates a group and navigates to its detail', async () => {
        render(<GroupEditModal initialName="" onHide={() => undefined} />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'GroupEditModal.name')), { target: { value: 'Nová skupina' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(pushedRoute).toBe('/group/new-g'))
        expect(mutationCalls[0]?.variables).toEqual({ input: { name: 'Nová skupina' } })
    })

    it('updates an existing group and reports the save', async () => {
        let hiddenWith: boolean | undefined = false
        render(<GroupEditModal id="g1" initialName="Staré jméno" onHide={(saved) => { hiddenWith = saved }} />)

        const nameInput = screen.getByPlaceholderText(translate(cs, 'GroupEditModal.name')) as HTMLInputElement
        expect(nameInput.value).toBe('Staré jméno')
        fireEvent.change(nameInput, { target: { value: 'Nové jméno' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(hiddenWith).toBe(true))
        expect(mutationCalls[0]?.variables).toEqual({ input: { id: 'g1', name: 'Nové jméno' } })
    })

    it('requires the name', () => {
        render(<GroupEditModal initialName="" onHide={() => undefined} />)

        fireEvent.submit(document.querySelector('form')!)
        expect(mutationCalls.length).toBe(0)
        expect(screen.getAllByText(translate(cs, 'Errors.required')).length).toBeGreaterThan(0)
    })
})
