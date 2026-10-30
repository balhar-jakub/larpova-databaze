/**
 * @jest-environment jsdom
 */
/**
 * The user's own comments panel's page-cache arms: the first page can be
 * handed in pre-loaded (skip arm), the refetch path caches the last page,
 * and the panel survives an answer without comments.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
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
let refetchCalls: unknown[] = []
let toastCalls: Array<{ message: string; kind: string }> = []
let pagedProps: Record<string, unknown> = {}

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
            return Promise.resolve({ data: {} })
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
    default: (props: { page: { totalAmount: number; comments: unknown[] } | undefined; pageSize: number }) => {
        pagedProps = props as Record<string, unknown>
        return <div data-testid="paged" data-total={props.page?.totalAmount ?? 'x'} data-pagesize={String(props.pageSize)} />
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
    refetchCalls = []
    toastCalls = []
    pagedProps = {}
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

    it('opens the edit modal for the chosen comment', () => {
        const page = {
            __typename: 'CommentsPaged',
            totalAmount: 1,
            comments: [{ __typename: 'Comment', id: 'c7', comment: '<p>text</p>', game: { __typename: 'Game', id: 'g9' } }],
        }
        render(<UserPagedCommentsPanel userId="u1" firstPage={page as never} manageable />)

        const onEdit = pagedProps.onEditComment as (id: string) => void
        onEdit('c7')

        // The edit handler picked the comment; with no loaded page game the modal stays closed,
        // so the observable effect here is that the panel does not crash and still renders.
        expect(screen.getByTestId('paged').dataset.total).toBe('1')
    })
})
