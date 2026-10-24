/**
 * @jest-environment jsdom
 */
/**
 * The game detail panel: the not-found state, the deleted-game notice,
 * and the delete flow (button only with the permission, confirm modal,
 * mutation, toast and reload).
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
) as Record<string, unknown>

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const toasts: Array<{ text: string; type: string }> = []
const mutations: Array<{ name: string; variables?: Record<string, unknown> }> = []
const pushedRoutes: string[] = []
let queryData: Record<string, unknown> | undefined = undefined

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({
        get data() { return queryData },
        loading: false,
        refetch: () => Promise.resolve(),
    }),
    useMutation: (options: unknown & { name?: string }) => [() => {
        mutations.push({ name: String((options as { name?: string }).name ?? 'unknown') })
        return Promise.resolve({ data: { game: { deleteGame: true } } })
    }, { loading: false }],
    useApolloClient: () => ({}),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
let loggedInRole: string | undefined = 'EDITOR'
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({ useLoggedInUser: () => ({ id: 'u1', role: loggedInRole }) }))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        gameEdit: () => ({ href: '/hra/edit', as: '/hra/edit' }),
        search: () => ({ href: '/search', as: '/search' }),
        homepage: () => ({ href: '/', as: '/' }),
        push: (r: { href: string }) => { pushedRoutes.push(r.href) },
    }),
}))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({ WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
jest.unstable_mockModule('../GameHeaderPanel', () => ({ GameHeaderPanel: () => <div data-testid="game-header" /> }))
jest.unstable_mockModule('../GameRatingPanel', () => ({ GameRatingPanel: () => <div data-testid="game-rating" /> }))
jest.unstable_mockModule('../../common/GameListPanel/GameListPanel', () => ({ GameListPanel: () => <div data-testid="game-list" /> }))
jest.unstable_mockModule('../../HomePage/EventListPanel', () => ({ EventListPanel: () => <div data-testid="event-list" /> }))
jest.unstable_mockModule('../SeriesListPanel', () => ({ SeriesListPanel: () => <div data-testid="series-list" /> }))
jest.unstable_mockModule('../ArticleListPanel', () => ({ ArticleListPanel: () => <div data-testid="article-list" /> }))
jest.unstable_mockModule('../GamePagedCommentsPanel', () => ({ GamePagedCommentsPanel: () => <div data-testid="paged-comments" /> }))
jest.unstable_mockModule('../RatingsListPanel', () => ({ default: () => <div data-testid="ratings-list" /> }))
jest.unstable_mockModule('../../common/ActionButton/ActionButton', () => ({
    default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>{children}</button>
    ),
}))
jest.unstable_mockModule('../../common/ConfirmationModal/ConfirmationModal', () => ({
    default: ({ show, content, confirmButtonText, onConfirm, onCancel }: {
        show: boolean; content: React.ReactNode; confirmButtonText?: React.ReactNode; onConfirm: () => void; onCancel: () => void
    }) => show ? (
        <div data-testid="confirm-modal">
            <div>{content}</div>
            <button type="button" onClick={onConfirm}>{confirmButtonText ?? 'Potvrdit'}</button>
            <button type="button" onClick={onCancel}>close</button>
        </div>
    ) : null,
}))

let GameDetailPanel: typeof import('../GameDetailPanel')['GameDetailPanel']

beforeAll(async () => {
    GameDetailPanel = (await import('../GameDetailPanel')).GameDetailPanel
})

beforeEach(() => {
    cleanup()
    loggedInRole = 'EDITOR'
    toasts.length = 0
    mutations.length = 0
    pushedRoutes.length = 0
    queryData = undefined
})

// The panel merges its query answer over emptyGame; one full game row is
// enough to render the whole layout.
const gameRow = (over: Record<string, unknown> = {}) => ({
    __typename: 'Game',
    id: 'g1',
    name: 'Dračí doupě',
    description: 'Popis',
    deleted: false,
    commentsDisabled: false,
    ratingsDisabled: false,
    video: undefined,
    coverImage: undefined,
    allowedActions: ['Edit', 'Delete'],
    ...over,
})

const renderPanel = () => render(<GameDetailPanel gameId="g1" />)

describe('GameDetailPanel', () => {
    it('shows the not-found message when the API answers with no game', async () => {
        queryData = { gameById: null }
        renderPanel()
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getByText(translate(cs, 'GameDetail.gameNotFound'))).toBeTruthy()
    })

    it('renders the detail layout with the delete action available', async () => {
        queryData = { gameById: gameRow() }
        renderPanel()
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getByTestId('game-header')).toBeTruthy()
        expect(screen.getByTestId('paged-comments')).toBeTruthy()
        expect(screen.getByTestId('ratings-list')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'GameDetail.deleteGame'))).toBeTruthy()
    })

    it('deletes the game after confirmation and toasts the result', async () => {
        queryData = { gameById: gameRow() }
        renderPanel()
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        fireEvent.click(screen.getByText(translate(cs, 'GameDetail.deleteGame')))
        const modal = await screen.findByTestId('confirm-modal')
        expect(modal).toBeTruthy()

        fireEvent.click(screen.getByText(translate(cs, 'ConfirmationModal.confirm')))
        await waitFor(() => expect(mutations.length).toBe(1))
        await waitFor(() => expect(toasts[0]?.type).toBe('success'))
    })

    it('keeps a deleted game without the delete button but with the notice', async () => {
        queryData = { gameById: gameRow({ deleted: true }) }
        renderPanel()
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getByText(translate(cs, 'GameDetail.deletedGameNotice'))).toBeTruthy()
        expect(screen.queryByText(translate(cs, 'GameDetail.deleteGame'))).toBeNull()
    })

    it('hides the ratings panel from a plain user', async () => {
        loggedInRole = 'USER'
        queryData = { gameById: gameRow() }
        renderPanel()
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getByTestId('paged-comments')).toBeTruthy()
        expect(screen.queryByTestId('ratings-list')).toBeNull()
    })

    it('hides the delete action when the permission is missing', async () => {
        queryData = { gameById: gameRow({ allowedActions: [] }) }
        renderPanel()
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.queryByText(translate(cs, 'GameDetail.deleteGame'))).toBeNull()
    })
})
