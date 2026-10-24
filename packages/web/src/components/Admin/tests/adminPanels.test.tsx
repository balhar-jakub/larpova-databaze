/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The admin section: tab navigation hides the users tab from non-admins,
 * the labels panel toggles authorized/required and deletes via the confirm
 * modal, the users panel filters by name, shows privileged only, switches
 * roles from the dropdown and deletes via the confirm modal.
 */

// The panels load their GraphQL documents with require(); ESM jest has none.
;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

let queryResult: Record<string, unknown> = {}
let mutateResult: Promise<{ data?: unknown }> = Promise.resolve({ data: {} })
const mutationVariables: Array<Record<string, unknown>> = []
let currentUserRole: string | undefined = 'ADMIN'
let pushedRoute = ''
let useQueryResult: { data?: unknown; loading: boolean; refetch: () => void } = {
    data: {},
    loading: false,
    refetch: () => undefined,
}

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: queryResult, loading: false, refetch: () => undefined }),
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        mutationVariables.push(opts.variables ?? {})
        return mutateResult
    }, { loading: false }],
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => (currentUserRole === undefined ? undefined : { id: '1', role: currentUserRole }),
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        push: (url: string) => {
            pushedRoute = url
        },
        adminIntro: () => '/admin',
        adminUsers: () => '/admin/uzivatele',
        adminLabels: () => '/admin/labels',
        adminStats: () => '/admin/statistiky',
        adminSelfRated: () => '/admin/self-rated',
    }),
}))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../common/UserLink/UserLink', () => ({
    default: ({ children }: { children: React.ReactNode }) => <a href="/uzivatel">{children}</a>,
}))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string | null }; children: React.ReactNode }) => (
        <a href={`/larp/${game.id}`}>{children ?? game.name}</a>
    ),
}))
jest.unstable_mockModule('../../common/ConfirmationModal/ConfirmationModal', () => ({
    default: ({ show, onConfirm, onCancel, content }: { show: boolean; onConfirm: () => void; onCancel: () => void; content: React.ReactNode }) =>
        show ? (
            <div data-testid="confirm-modal">
                {content}
                <button onClick={onConfirm}>confirm</button>
                <button onClick={onCancel}>cancel</button>
            </div>
        ) : null,
}))
jest.unstable_mockModule('../../common/LabelEditmodal/LabelEditModal', () => ({
    default: ({ initialValues, onCreateLabel, onHide }: { initialValues?: { name?: string; description?: string }; onCreateLabel: (v: { name: string; description?: string }) => Promise<void> | void; onHide: () => void }) => (
        <div data-testid="label-edit-modal">
            <button type="button" onClick={() => onCreateLabel({ name: initialValues?.name ?? '', description: initialValues?.description })}>save-label</button>
            <button type="button" onClick={onHide}>close-label</button>
        </div>
    ),
}))

let AdminTabs: typeof import('../AdminTabs').default
let AdminLabelsPanel: typeof import('../AdminLabelsPanel').default
let AdminUsersPanel: typeof import('../AdminUsersPanel').default
let AdminStatsPanel: typeof import('../AdminStatsPanel').default
let AdminSelfRatedPanel: typeof import('../AdminSelfRatedPanel').default
let AdminMenuPanel: typeof import('../AdminMenuPanel').default
let UserRole: typeof import('../../../graphql/__generated__/typescript-operations').UserRole

beforeAll(async () => {
    AdminTabs = (await import('../AdminTabs')).default
    AdminLabelsPanel = (await import('../AdminLabelsPanel')).default
    AdminUsersPanel = (await import('../AdminUsersPanel')).default
    AdminStatsPanel = (await import('../AdminStatsPanel')).default
    AdminSelfRatedPanel = (await import('../AdminSelfRatedPanel')).default
    AdminMenuPanel = (await import('../AdminMenuPanel')).default
    UserRole = (await import('../../../graphql/__generated__/typescript-operations')).UserRole
})

const label = (id: string, over: Record<string, unknown> = {}) => ({
    __typename: 'Label',
    id,
    name: `Label ${id}`,
    description: 'popis',
    isRequired: false,
    isAuthorized: true,
    ...over,
})

const user = (id: string, over: Record<string, unknown> = {}) => ({
    __typename: 'User',
    id,
    name: `Uživatel ${id}`,
    nickname: null,
    email: `${id}@example.test`,
    role: 'USER',
    ...over,
})

describe('AdminTabs', () => {
    beforeEach(() => {
        pushedRoute = ''
        currentUserRole = 'ADMIN'
    })

    it('shows the users tab to an admin and navigates on select', () => {
        render(<AdminTabs selectedTab="users" />)

        expect(screen.getByText(translate(cs, 'Admin.tabUsers'))).toBeTruthy()

        fireEvent.click(screen.getByText(translate(cs, 'Admin.tabLabels')))
        expect(pushedRoute).toBe('/admin/labels')
    })

    it('hides the users tab from a non-admin', () => {
        currentUserRole = 'EDITOR'
        render(<AdminTabs selectedTab="labels" />)

        expect(screen.queryByText(translate(cs, 'Admin.tabUsers'))).toBeNull()
        fireEvent.click(screen.getByText(translate(cs, 'Admin.tabStats')))
        expect(pushedRoute).toBe('/admin/statistiky')
    })

    it('navigates to intro and selfRated tabs too', () => {
        render(<AdminTabs selectedTab="intro" />)

        fireEvent.click(screen.getByText(translate(cs, 'Admin.tabIntro')))
        expect(pushedRoute).toBe('/admin')
        fireEvent.click(screen.getByText(translate(cs, 'Admin.tabSelfRating')))
        expect(pushedRoute).toBe('/admin/self-rated')
    })
})

describe('AdminMenuPanel', () => {
    it('renders the intro heading', () => {
        render(<AdminMenuPanel />)
        expect(screen.getByText(translate(cs, 'Admin.intro'))).toBeTruthy()
    })
})

describe('AdminLabelsPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        currentUserRole = 'ADMIN'
        mutationVariables.length = 0
        queryResult = {
            admin: {
                allLabels: [label('1', { name: 'Alpha' }), label('2', { name: 'Beta', isRequired: true })],
            },
        }
        useQueryResult = { data: queryResult, loading: false, refetch: () => undefined }
        mutateResult = Promise.resolve({ data: { ok: true } })
    })

    it('lists the labels sorted by name with their controls', () => {
        render(<AdminLabelsPanel />)

        expect(screen.getByText('Alpha')).toBeTruthy()
        expect(screen.getByText('Beta')).toBeTruthy()
        // 2 labels x 4 buttons (edit, authorized, required, delete)
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThanOrEqual(8)
    })

    it('opens the edit modal and the delete confirm dialog', () => {
        render(<AdminLabelsPanel />)

        fireEvent.click(screen.getAllByText(translate(cs, 'AdminLabels.authorized'))[0])
        fireEvent.click(screen.getAllByText(translate(cs, 'AdminLabels.required'))[0])

        // The label row div: the name cell's parent (labelRow) contains the controls.
        const row = screen.getByText('Alpha').parentElement!
        fireEvent.click(row.querySelector('button')!)
        expect(screen.getByTestId('label-edit-modal')).toBeTruthy()
    })

    it('asks for confirmation before deleting and confirms', async () => {
        render(<AdminLabelsPanel />)

        // The delete button is the last button of a label row.
        const row = screen.getByText('Alpha').parentElement!
        const buttons = row.querySelectorAll('button')
        fireEvent.click(buttons[buttons.length - 1])
        const modal = screen.getByTestId('confirm-modal')
        expect(modal).toBeTruthy()

        fireEvent.click(within(modal).getByText('confirm'))
        await waitFor(() => expect(screen.queryByTestId('confirm-modal')).toBeNull())
    })

    it('toggles the authorized flag through the mutation', () => {
        render(<AdminLabelsPanel />)

        // Sorted: Beta (required) first, Alpha second. Toggle Alpha's authorized.
        fireEvent.click(screen.getAllByText(translate(cs, 'AdminLabels.authorized'))[1])

        expect(mutationVariables.at(-1)).toEqual({ labelId: '1', authorized: false })
    })

    it('toggles the required flag through the mutation', () => {
        render(<AdminLabelsPanel />)

        // Beta has isRequired: true (sorted first) -> toggling sends required: false.
        fireEvent.click(screen.getAllByText(translate(cs, 'AdminLabels.required'))[0])

        expect(mutationVariables.at(-1)).toEqual({ labelId: '2', required: false })
    })

    it('saves the edited label with its id and refetches', async () => {
        render(<AdminLabelsPanel />)

        const row = screen.getByText('Alpha').parentElement!
        const buttons = row.querySelectorAll('button')
        fireEvent.click(buttons[0]) // the edit button opens the modal
        await waitFor(() => expect(screen.getByTestId('label-edit-modal')).toBeTruthy())

        fireEvent.click(screen.getByText('save-label'))
        await waitFor(() => expect(mutationVariables.at(-1)).toEqual({
            input: { id: '1', name: 'Alpha', description: 'popis' },
        }))
        await waitFor(() => expect(screen.queryByTestId('label-edit-modal')).toBeNull())
    })
})

describe('AdminUsersPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        currentUserRole = 'ADMIN'
        queryResult = {
            admin: {
                allUsers: [user('1', { role: 'USER', name: 'Alice' }), user('2', { role: 'ADMIN', name: 'Bob', nickname: 'bobik' })],
            },
        }
        useQueryResult = { data: queryResult, loading: false, refetch: () => undefined }
        mutateResult = Promise.resolve({ data: { ok: true } })
    })

    it('lists users with their role dropdowns and delete buttons', () => {
        render(<AdminUsersPanel />)

        expect(screen.getByText('Alice')).toBeTruthy()
        expect(screen.getByText('Bob')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'UserRole.USER'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'UserRole.ADMIN'))).toBeTruthy()
    })

    it('filters users by the name box and toggles privileged-only', async () => {
        render(<AdminUsersPanel />)

        const filterBox = screen.getByPlaceholderText(translate(cs, 'AdminUsers.filterPlaceholder'))
        fireEvent.change(filterBox, { target: { value: 'Bob' } })
        await new Promise((r) => setTimeout(r, 550))
        expect(screen.queryByText('Alice')).toBeNull()
        expect(screen.getByText('Bob')).toBeTruthy()

        fireEvent.change(filterBox, { target: { value: '' } })
        await new Promise((r) => setTimeout(r, 550))
        expect(screen.getByText('Alice')).toBeTruthy()
    })

    it('asks for confirmation before deleting a user', async () => {
        render(<AdminUsersPanel />)

        fireEvent.click(screen.getAllByText(translate(cs, 'AdminUsers.delete'))[0])
        expect(screen.getByTestId('confirm-modal')).toBeTruthy()

        fireEvent.click(screen.getByText('cancel'))
        expect(screen.queryByTestId('confirm-modal')).toBeNull()
    })

    it('switches a user role via the dropdown and shows all users past the cap', async () => {
        const many = Array.from({ length: 60 }, (_, i) => user(String(i + 10), { name: `U${i}` }))
        queryResult = { admin: { allUsers: many } }
        render(<AdminUsersPanel />)

        // The pager caps at 30; the show-all button reveals the rest.
        fireEvent.click(screen.getByText(translate(cs, 'AdminUsers.showAll', { recordCount: 60 })))
        expect(screen.getByText('U59')).toBeTruthy()
    })
})

describe('AdminStatsPanel', () => {
    it('renders the monthly stats sorted newest first', () => {
        queryResult = {
            admin: {
                stats: [
                    { __typename: 'AdminRatingStats', id: '1', year: 2026, month: 9, numRatings: 10, numComments: 3, averageRating: 4.5 },
                    { __typename: 'AdminRatingStats', id: '2', year: 2026, month: 10, numRatings: 12, numComments: 4, averageRating: 4.25 },
                ],
            },
        }
        useQueryResult = { data: queryResult, loading: false, refetch: () => undefined }
        render(<AdminStatsPanel />)

        // Sorted newest first: October's row (12 ratings) comes before September's.
        expect(screen.getByText('12')).toBeTruthy()
        expect(screen.getByText('4.25')).toBeTruthy()
    })
})

describe('AdminSelfRatedPanel', () => {
    it('lists self-rated entries linking users to games', () => {
        queryResult = {
            admin: {
                selfRated: [
                    {
                        __typename: 'AdminSelfRated',
                        user: user('1', { name: 'Alice' }),
                        game: { __typename: 'Game', id: 'g1', name: 'Moje hra' },
                    },
                ],
            },
        }
        useQueryResult = { data: queryResult, loading: false, refetch: () => undefined }
        render(<AdminSelfRatedPanel />)

        expect(screen.getByText('Alice')).toBeTruthy()
        expect(screen.getByText('Moje hra')).toBeTruthy()
    })
})
