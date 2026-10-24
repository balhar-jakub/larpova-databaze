/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, act } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const cs = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'))
;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const queryData = {
    gameById: {
        __typename: 'Game', id: 'g1',
        commentsPaged: { __typename: 'CommentsPaged', totalAmount: 1, list: [] },
        currentUsersComment: { __typename: 'UsersComment', id: 'c9', comment: { __typename: 'Comment', id: 'c9', text: 'x', added: '2027-03-01' } },
    },
}

jest.unstable_mockModule('src/lib/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'cs', ready: true }) }))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: queryData, loading: false, refetch: () => Promise.resolve() }),
    useMutation: () => [() => Promise.resolve({ data: {} }), { loading: false }],
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({ useLoggedInUser: () => ({ id: 'u1' }) }))
jest.unstable_mockModule('../../common/PagedCommentsPanel/PagedCommentsPanel', () => ({
    default: () => <div data-testid="paged-comments" />,
}))
jest.unstable_mockModule('../EditCommentModal', () => ({ default: () => <div data-testid="edit-comment-modal" /> }))

it('debug', async () => {
    const { GamePagedCommentsPanel } = await import('../GamePagedCommentsPanel')
    render(<GamePagedCommentsPanel gameId="g1" commentsDisabled={false} />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    process.stdout.write('HAS-WRAPPER: ' + document.body.innerHTML.includes('updateComment') + '\n')
    process.stdout.write('HAS-DELETE: ' + document.body.innerHTML.includes('deleteComment') + '\n')
    process.stdout.write('BODY: ' + document.body.innerHTML.slice(0, 300) + '\n')
})
