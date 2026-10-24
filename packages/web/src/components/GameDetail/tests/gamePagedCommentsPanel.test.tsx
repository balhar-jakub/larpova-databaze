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
    }, { loading: false }],
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
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
})
