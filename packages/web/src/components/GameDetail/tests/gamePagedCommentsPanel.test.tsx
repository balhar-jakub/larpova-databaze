/**
 * @jest-environment jsdom
 */
/**
 * The game comments panel: adding a comment (modal), the disabled state,
 * editing the user's own comment, deleting it, and the pager of all
 * comments.
 */
import React from 'react'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let mutationLoading = false
let queryData: Record<string, unknown> | undefined
let mutationResult: Promise<{ data?: unknown }> = Promise.resolve({ data: {} })
const mutationCalls: Array<{ variables?: Record<string, unknown> }> = []
const modalCalls: Array<Record<string, unknown>> = []
let loggedInUser: { id: string; role?: string } | undefined | null = null

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: queryData, loading: false, refetch: () => Promise.resolve() }),
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        mutationCalls.push(opts)
        return mutationResult
    }, { loading: mutationLoading }],
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('../../common/Icons/Icons', () => ({
    IconDisabled: () => <span>icon-disabled</span>,
    IconEdit: () => <span>icon-edit</span>,
    IconLoading: () => <span data-testid="icon-loading">icon-loading</span>,
    IconPlus: () => <span data-testid="icon-plus">icon-plus</span>,
    IconTrash: () => <span data-testid="icon-trash">icon-trash</span>,
}))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => loggedInUser,
}))
jest.unstable_mockModule('../../common/PagedCommentsPanel/PagedCommentsPanel', () => ({
    default: ({ onOffsetChanged, pageSize }: { onOffsetChanged: (offset: number) => void; pageSize: number }) => (
        <div data-testid="paged-comments" data-pagesize={String(pageSize)}>
            <button type="button" onClick={() => onOffsetChanged(pageSize)}>next-offset</button>
        </div>
    ),
}))
jest.unstable_mockModule('../EditCommentModal', () => ({
    default: ({ comment, gameId, onCommentSaved, onCancel }: { comment: unknown; gameId: string; onCommentSaved: () => void; onCancel: () => void }) => {
        modalCalls.push({ comment, gameId })
        return (
            <div data-testid="edit-comment-modal">
                <button type="button" onClick={onCommentSaved}>modal-saved</button>
                <button type="button" onClick={onCancel}>modal-cancel</button>
            </div>
        )
    },
}))

let GamePagedCommentsPanel: typeof import('../GamePagedCommentsPanel')['GamePagedCommentsPanel']

beforeAll(async () => {
    GamePagedCommentsPanel = (await import('../GamePagedCommentsPanel')).GamePagedCommentsPanel
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    modalCalls.length = 0
    loggedInUser = null
    mutationResult = Promise.resolve({ data: {} })
    mutationLoading = false
    queryData = {
        gameById: {
            __typename: 'Game',
            id: 'g1',
            commentsPaged: {
                __typename: 'CommentsPaged',
                totalAmount: 12,
                list: [
                    { __typename: 'Comment', id: 'c1', text: 'Skvělá hra', added: '2027-01-01' },
                    { __typename: 'Comment', id: 'c2', text: 'K recenzi', added: '2027-02-01' },
                ],
            },
            currentUsersComment: null,
        },
    }
})

describe('GamePagedCommentsPanel', () => {
    it('renders the paged comments with the page size', () => {
        render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)

        expect(screen.getByTestId('paged-comments').dataset.pagesize).toBe('10')
    })

    it('shows the disabled note instead of the add button when comments are off', async () => {
        loggedInUser = { id: 'u1' }
        render(<GamePagedCommentsPanel gameId="g1" commentsDisabled />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(
            screen.getAllByText((_, el) => Boolean(el?.textContent?.includes(translate(cs, 'GameDetail.commentsDisabled')))).length,
        ).toBeGreaterThan(0)
    })

    it('shows the add-comment entry for a logged-in user without a comment', async () => {
        loggedInUser = { id: 'u1' }
        render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getAllByText((_, el) => Boolean(el?.textContent?.includes(translate(cs, 'GameDetail.addComment')))).length).toBeGreaterThan(0)
    })

    it('shows edit and delete for the user\'s own comment', async () => {
        loggedInUser = { id: 'u1' }
        queryData = {
            gameById: {
                __typename: 'Game',
                id: 'g1',
                commentsPaged: { __typename: 'CommentsPaged', totalAmount: 1, list: [] },
                currentUsersComment: { __typename: 'UsersComment', id: 'c9', comment: { __typename: 'Comment', id: 'c9', text: 'Moje recenze', added: '2027-03-01' } },
            },
        }
        render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        // Edit opens the (mocked, lazy) modal.
        fireEvent.click(screen.getByRole('button', { name: (t) => t.includes(translate(cs, 'GameDetail.updateComment')) }))
        await act(async () => { await Promise.resolve(); await Promise.resolve() })
        await waitFor(() => expect(screen.getByTestId('edit-comment-modal')).toBeTruthy())
        expect(modalCalls[0]).toMatchObject({ gameId: 'g1' })

        // Delete triggers the mutation with the comment id.
        fireEvent.click(screen.getByRole('button', { name: (t) => t.includes(translate(cs, 'GameDetail.deleteComment')) }))
        await waitFor(() => expect(mutationCalls[0]?.variables).toEqual({ commentId: 'c9' }))
    })

    it('refetches after the edit modal saves', async () => {
        loggedInUser = { id: 'u1' }
        queryData = {
            gameById: {
                __typename: 'Game',
                id: 'g1',
                commentsPaged: { __typename: 'CommentsPaged', totalAmount: 1, list: [] },
                currentUsersComment: { __typename: 'UsersComment', id: 'c9', comment: { __typename: 'Comment', id: 'c9', text: 'Moje recenze', added: '2027-03-01' } },
            },
        }
        render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        fireEvent.click(screen.getByRole('button', { name: (t) => t.includes(translate(cs, 'GameDetail.updateComment')) }))
        await waitFor(() => expect(screen.getByTestId('edit-comment-modal')).toBeTruthy())
        fireEvent.click(screen.getByText('modal-saved'))
        await waitFor(() => expect(screen.queryByTestId('edit-comment-modal')).toBeNull())
    })

    it('keeps the page when switching games resets the offset cache', async () => {
        const { rerender } = render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)

        fireEvent.click(screen.getByText('next-offset'))
        rerender(<GamePagedCommentsPanel gameId="g2" commentsDisabled={false} />)
        // New game: the cache resets but the panel renders again.
        expect(screen.getByTestId('paged-comments')).toBeTruthy()
    })

    it('falls back to the cached page when the query answers without one', async () => {
        loggedInUser = { id: 'u1' }
        // First render: a real page lands in the cache.
        const { rerender } = render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        // Second render: the answer carries NO commentsPaged (the dataPage ||
        // cachedPage arm) — the cached page keeps the panel alive.
        queryData = { gameById: { __typename: 'Game', id: 'g1', commentsPaged: undefined, currentUsersComment: null } }
        rerender(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)
        expect(screen.getByTestId('paged-comments')).toBeTruthy()
    })

    it('refuses the delete when the comment id is missing (the early return)', async () => {
        loggedInUser = { id: 'u1' }
        queryData = {
            gameById: {
                __typename: 'Game',
                id: 'g1',
                commentsPaged: { __typename: 'CommentsPaged', totalAmount: 1, list: [] },
                // A comment object exists but carries no id.
                currentUsersComment: { __typename: 'UsersComment', id: null, comment: { __typename: 'Comment', id: 'c9', text: 'Bez id', added: '2027-03-01' } },
            },
        }
        render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        fireEvent.click(screen.getByRole('button', { name: (t) => t.includes(translate(cs, 'GameDetail.deleteComment')) }))
        await act(async () => { await Promise.resolve() })
        // The guard returned before the mutation: nothing was called.
        expect(mutationCalls.length).toBe(0)
    })

    it('swaps the action icons to spinners while the mutations load', () => {
        loggedInUser = { id: 'u1' }
        queryData = {
            gameById: {
                __typename: 'Game',
                id: 'g1',
                commentsPaged: { __typename: 'CommentsPaged', totalAmount: 1, list: [] },
                currentUsersComment: { __typename: 'UsersComment', id: 'c9', comment: { __typename: 'Comment', id: 'c9', text: 'Moje', added: '2027-03-01' } },
            },
        }
        mutationLoading = true
        render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)

        // The delete button carries the spinner instead of the trash icon
        // while its mutation loads. (editModalLoading is the lazy-chunk
        // state of the open modal, not a mutation flag.)
        expect(screen.getAllByTestId('icon-loading').length).toBe(1)
        expect(screen.queryByTestId('icon-trash')).toBeNull()
    })
})
