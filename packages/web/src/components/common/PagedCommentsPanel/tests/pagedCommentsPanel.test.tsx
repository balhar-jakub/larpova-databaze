/**
 * @jest-environment jsdom
 */
/**
 * The shared paged comments list: it marks a comment as manageable only
 * when the panel is manageable AND the comment author is the logged-in
 * user, and forwards the management callbacks down to the rows.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let loggedInUser: { id: string; role?: string } | undefined
let rowProps: Array<Record<string, unknown>> = []

jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({ mutate: () => Promise.resolve() }),
}))
jest.unstable_mockModule('../../../../hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => loggedInUser,
}))
jest.unstable_mockModule('../../GameCommentPanel/GameCommentPanel', () => ({
    default: (props: Record<string, unknown>) => {
        rowProps.push(props)
        return <div data-testid="row" data-id={String(props.comment && (props.comment as { id: string }).id)} />
    },
}))
jest.unstable_mockModule('../../Pager/Pager', () => ({
    default: () => <div data-testid="pager" />,
}))

let PagedCommentsPanel: typeof import('../PagedCommentsPanel').default

beforeAll(async () => {
    PagedCommentsPanel = (await import('../PagedCommentsPanel')).default
})

beforeEach(() => {
    cleanup()
    loggedInUser = undefined
    rowProps = []
})

const commentOf = (id: string, userId: string) => ({
    __typename: 'Comment',
    id,
    comment: '<p>x</p>',
    added: '2026-05-01T10:00:00',
    amountOfUpvotes: 0,
    isHidden: false,
    user: { __typename: 'User', id: userId, name: 'A B', nickname: 'a' },
})

const page = {
    __typename: 'CommentsPaged',
    totalAmount: 2,
    comments: [commentOf('c1', 'u1'), commentOf('c2', 'u2')],
}

describe('PagedCommentsPanel', () => {
    it('marks only the logged-in user\'s comments as manageable when manageable', () => {
        loggedInUser = { id: 'u1' }
        render(
            <PagedCommentsPanel
                page={page as never}
                pageSize={10}
                offset={0}
                onOffsetChanged={() => undefined}
                manageable
                onEditComment={() => undefined}
                onDeleteComment={() => undefined}
            />,
        )

        expect(rowProps[0].canManage).toBe(true)
        expect(rowProps[1].canManage).toBe(false)
        expect(typeof rowProps[0].onEditComment).toBe('function')
        expect(typeof rowProps[0].onDeleteComment).toBe('function')
    })

    it('marks nothing manageable when the panel is not manageable', () => {
        loggedInUser = { id: 'u1' }
        render(
            <PagedCommentsPanel
                page={page as never}
                pageSize={10}
                offset={0}
                onOffsetChanged={() => undefined}
            />,
        )

        expect(rowProps[0].canManage).toBeFalsy()
        expect(rowProps[1].canManage).toBeFalsy()
    })

    it('marks nothing manageable for an anonymous viewer', () => {
        loggedInUser = undefined
        render(
            <PagedCommentsPanel
                page={page as never}
                pageSize={10}
                offset={0}
                onOffsetChanged={() => undefined}
                manageable
                onEditComment={() => undefined}
                onDeleteComment={() => undefined}
            />,
        )

        expect(rowProps.every(r => r.canManage === false)).toBe(true)
    })

    it('forwards the visibility toggle to the row', () => {
        loggedInUser = { id: 'u1', role: 'ADMIN' as never }
        render(
            <PagedCommentsPanel
                page={page as never}
                pageSize={10}
                offset={0}
                onOffsetChanged={() => undefined}
            />,
        )

        expect(rowProps[0].showVisibilityButton).toBe(true)
        const onVisibility = rowProps[0].onChangeCommentVisibility as (id: string, hidden: boolean) => void
        expect(() => onVisibility('c1', true)).not.toThrow()
    })

    it('renders the pager with a missing page', () => {
        render(
            <PagedCommentsPanel
                page={undefined}
                pageSize={10}
                offset={0}
                onOffsetChanged={() => undefined}
            />,
        )

        // No page: no rows, the pager still renders with a zero total.
        expect(rowProps).toEqual([])
        expect(screen.getByTestId('pager')).toBeTruthy()
    })
})
