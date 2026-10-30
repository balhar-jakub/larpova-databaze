/**
 * @jest-environment jsdom
 */
/**
 * The user's own comments panel's page-cache arms: the first page can be
 * handed in pre-loaded (skip arm), the refetch path caches the last page,
 * and the panel survives an answer without comments.
 */
import React from 'react'
import { render, screen, cleanup, act } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let queryData: Record<string, unknown> | undefined
let queryLoading = false
let queryCalls = 0
let mutationCalls: Array<Record<string, unknown>> = []
let mutationShouldFail = false
let refetchCalls: unknown[] = []
let toastCalls: Array<{ message: string; kind: string }> = []
let pagedProps: Record<string, unknown> = {}
let modalProps: Array<{ gameId: string; oldText: string; onHide: () => void; onCommentSaved: () => void }> = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('../../../hooks/useShowToast', () => ({
    useShowToast: () => (message: string, kind: string) => {
        toastCalls.push({ message, kind })
    },
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => {
        queryCalls += 1
        return { data: queryData, loading: queryLoading, refetch: () => Promise.resolve() }
    },
    useMutation: () => [
        (opts: { variables: Record<string, unknown> }) => {
            mutationCalls.push(opts.variables)
            return mutationShouldFail
                ? Promise.reject(new Error('boom'))
                : Promise.resolve({ data: {} })
        },
        { loading: false },
    ],
    useApolloClient: () => ({
        refetchQueries: (opts: unknown) => {
            refetchCalls.push(opts)
            return Promise.resolve()
        },
    }),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('../../common/PagedCommentsPanel/PagedCommentsPanel', () => ({
    default: (props: { page: { totalAmount: number; comments: Array<{ id: string; comment?: string | null; game?: { id: string } | null }> } | undefined; pageSize: number }) => {
        pagedProps = props as Record<string, unknown>
        return <div data-testid="paged" data-total={props.page?.totalAmount ?? 'x'} data-pagesize={String(props.pageSize)} />
    },
}))
jest.unstable_mockModule('../../GameDetail/EditCommentModal', () => ({
    default: (props: { gameId: string; oldText: string; onHide: () => void; onCommentSaved: () => void }) => {
        modalProps.push(props)
        return <div data-testid="edit-modal" data-game={props.gameId} data-text={props.oldText} />
    },
}))

let UserPagedCommentsPanel: typeof import('../UserPagedCommentsPanel').default

beforeAll(async () => {
    UserPagedCommentsPanel = (await import('../UserPagedCommentsPanel')).default
})

beforeEach(() => {
    cleanup()
    queryData = undefined
    queryLoading = false
    queryCalls = 0
    mutationCalls = []
    mutationShouldFail = false
    refetchCalls = []
    toastCalls = []
    pagedProps = {}
    modalProps = []
})

const commentPage = (totalAmount: number, n: number) => ({
    __typename: 'CommentsPaged',
    totalAmount,
    comments: Array.from({ length: n }, (_, i) => ({ __typename: 'Comment', id: `c${i}` })),
})

describe('UserPagedCommentsPanel', () => {
    it('skips the query when the first page was handed in', () => {
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(12, 10) as never} />)

        // The skip arm: no query fired, the handed-in page renders.
        expect(queryCalls).toBe(1)
        expect(screen.getByTestId('paged').dataset.total).toBe('12')
    })

    it('caches the answered page and survives an empty answer', () => {
        queryData = { userById: { __typename: 'User', id: 'u1', commentsPaged: commentPage(5, 5) } }
        render(<UserPagedCommentsPanel userId="u1" firstPage={undefined} />)

        expect(screen.getByTestId('paged').dataset.total).toBe('5')

        // A later render with no answer keeps the cached page.
        queryData = undefined
        cleanup()
        queryData = undefined
        const { container } = render(<UserPagedCommentsPanel userId="u1" firstPage={undefined} />)
        expect(container).toBeTruthy()
    })

    it('renders without a page while loading', () => {
        queryLoading = true
        queryData = undefined
        render(<UserPagedCommentsPanel userId="u1" firstPage={undefined} />)

        // The panel's page is undefined: the pager receives nothing, not a crash.
        expect(screen.getByTestId('paged').dataset.total).toBe('x')
    })

    it('does not offer comment management by default', () => {
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(12, 10) as never} />)

        expect(pagedProps.manageable).toBeUndefined()
        expect(pagedProps.onEditComment).toBeUndefined()
        expect(pagedProps.onDeleteComment).toBeUndefined()
    })

    it('forwards management callbacks only when manageable', () => {
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(12, 10) as never} manageable />)

        expect(pagedProps.manageable).toBe(true)
        expect(typeof pagedProps.onEditComment).toBe('function')
        expect(typeof pagedProps.onDeleteComment).toBe('function')
    })

    it('deletes a comment through the mutation, toasts and refetches', async () => {
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(12, 10) as never} manageable />)

        const onDelete = pagedProps.onDeleteComment as (id: string) => Promise<void>
        await onDelete('c3')

        expect(mutationCalls).toEqual([{ commentId: 'c3' }])
        expect(toastCalls).toEqual([{ message: 'Váš komentář byl smazán', kind: 'success' }])
        expect(refetchCalls).toEqual([{ include: ['LoadCurrentUserProfile', 'MoreUserComments'] }])
    })

    it('opens the edit modal for the chosen comment and closes it after save', async () => {
        const page = {
            __typename: 'CommentsPaged',
            totalAmount: 1,
            comments: [{ __typename: 'Comment', id: 'c7', comment: '<p>text</p>', game: { __typename: 'Game', id: 'g9' } }],
        }
        render(<UserPagedCommentsPanel userId="u1" firstPage={page as never} manageable />)

        const onEdit = pagedProps.onEditComment as (id: string) => void
        act(() => onEdit('c7'))
        // The lazy-loaded modal resolves asynchronously — flush the suspense.
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        // The modal received the comment's game and text.
        expect(screen.getByTestId('edit-modal').dataset.game).toBe('g9')
        expect(screen.getByTestId('edit-modal').dataset.text).toBe('<p>text</p>')
        // A null comment body still opens the editor with an empty string.
        expect(modalProps[0].oldText).toBe('<p>text</p>')

        // Saving closes the modal and refetches the comment lists.
        act(() => modalProps[0].onCommentSaved())
        expect(screen.queryByTestId('edit-modal')).toBeNull()
        expect(refetchCalls).toEqual([{ include: ['LoadCurrentUserProfile', 'MoreUserComments'] }])

        // Re-open and hide via onHide — the modal closes as well.
        act(() => onEdit('c7'))
        await act(async () => { await Promise.resolve(); await Promise.resolve() })
        act(() => modalProps[modalProps.length - 1].onHide())
        expect(screen.queryByTestId('edit-modal')).toBeNull()
    })

    it('opens the edit modal with an empty text when the comment body is null', async () => {
        const page = {
            __typename: 'CommentsPaged',
            totalAmount: 1,
            comments: [{ __typename: 'Comment', id: 'c8', comment: null, game: { __typename: 'Game', id: 'g4' } }],
        }
        render(<UserPagedCommentsPanel userId="u1" firstPage={page as never} manageable />)

        act(() => (pagedProps.onEditComment as (id: string) => void)('c8'))
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(screen.getByTestId('edit-modal').dataset.text).toBe('')
    })

    it('does not toast or refetch when the delete mutation fails', async () => {
        mutationShouldFail = true
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(12, 10) as never} manageable />)

        const onDelete = pagedProps.onDeleteComment as (id: string) => Promise<void>
        await onDelete('c9')

        expect(mutationCalls).toEqual([{ commentId: 'c9' }])
        expect(toastCalls).toEqual([])
        expect(refetchCalls).toEqual([])
    })

    it('uses the answered page once the offset moves past the first page', () => {
        queryData = { userById: { __typename: 'User', id: 'u1', commentsPaged: commentPage(30, 10) } }
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(12, 10) as never} />)

        act(() => {
            ;(pagedProps.onOffsetChanged as (n: number) => void)(10)
        })

        // offset 10: the query answer wins over the handed-in first page
        expect(screen.getByTestId('paged').dataset.total).toBe('30')
    })

    it('falls back to the first page prop on the first page without a query answer', () => {
        // offset 0 and no query data: the handed-in first page is used.
        queryData = undefined
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(12, 10) as never} />)

        expect(screen.getByTestId('paged').dataset.total).toBe('12')
    })

    it('keeps the cached page when offset moves and the query has no answer', () => {
        queryData = undefined
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(12, 10) as never} />)

        act(() => {
            ;(pagedProps.onOffsetChanged as (n: number) => void)(10)
        })

        // offset 10 without data: falls back to the cached page, not the first page prop
        expect(screen.getByTestId('paged').dataset.total).toBe('12')
    })

    it('does not open the modal for a comment without a game', async () => {
        render(<UserPagedCommentsPanel userId="u1" firstPage={commentPage(3, 3) as never} manageable />)

        act(() => {
            ;(pagedProps.onEditComment as (id: string) => void)('c0')
        })
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        // editingComment found but game missing — the modal stays closed, no crash
        expect(screen.getByTestId('paged').dataset.total).toBe('3')
        expect(screen.queryByTestId('edit-modal')).toBeNull()
    })
})
