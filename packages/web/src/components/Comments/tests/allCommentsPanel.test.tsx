/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The all-comments listing: the page the homepage's „všechny komentáře“ link
 * opens. Pins that the page renders the comment rows the API answers with,
 * that the pager drives the query's offset, and that an empty database gets a
 * sentence instead of an empty panel.
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

let queryResult: Record<string, unknown> = {}
let queryVariables: Record<string, unknown> = {}

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options), locale: 'cs', ready: true }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: (_document: unknown, options: { variables: Record<string, unknown> }) => {
        queryVariables = options.variables
        return queryResult
    },
    useApolloClient: () => ({ mutate: () => Promise.resolve() }),
}))
jest.unstable_mockModule('next/head', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/GameCommentPanel/GameCommentPanel', () => ({
    default: ({ comment }: { comment: { commentAsText?: string | null } }) => (
        <div>{comment.commentAsText}</div>
    ),
}))
// The real panel is untestable under ESM jest (it loads its document through
// `require`), so it is replaced by the same contract: the rows, then the pager.
jest.unstable_mockModule('../../common/PagedCommentsPanel/PagedCommentsPanel', () => ({
    default: ({ page, offset, onOffsetChanged }: {
        page: { totalAmount: number; comments: { id: string; commentAsText?: string | null }[] },
        offset: number,
        onOffsetChanged: (n: number) => void,
    }) => (
        <div>
            {page.comments.map((comment) => (
                <div key={comment.id}>{comment.commentAsText}</div>
            ))}
            {page.totalAmount > 10 && (
                <button type="button" onClick={() => onOffsetChanged(offset + 10)}>next</button>
            )}
        </div>
    ),
}))

let Panel: typeof import('../AllCommentsPanel').AllCommentsPanel

beforeAll(async () => {
    Panel = (await import('../AllCommentsPanel')).AllCommentsPanel
})

const commentRow = (id: string, text: string) => ({
    id,
    commentAsText: text,
    added: '2026-10-01T10:00:00.000Z',
    amountOfUpvotes: 0,
    comment: '<p>html</p>',
    isHidden: false,
    user: { id: '1', name: 'Autor', nickname: 'Autor', image: null },
    game: { id: '5', name: 'Hra', averageRating: 80, amountOfRatings: 3 },
})

test('renders the newest comments with the pager', () => {
    queryResult = {
        loading: false,
        data: {
            allComments: {
                totalAmount: 25,
                comments: [commentRow('1', 'Nejnovější komentář'), commentRow('2', 'Starší komentář')],
            },
        },
    }

    render(<Panel />)

    expect(screen.getByText('Všechny komentáře')).toBeTruthy()
    expect(screen.getByText('Nejnovější komentář')).toBeTruthy()
    expect(screen.getByText('Starší komentář')).toBeTruthy()
    // 25 comments means there is a second page — the pager offers it.
    expect(screen.getByText('next')).toBeTruthy()
})

test('a pager click asks the server for the next page', () => {
    queryResult = {
        loading: false,
        data: {
            allComments: { totalAmount: 25, comments: [commentRow('1', 'První stránka')] },
        },
    }

    render(<Panel />)
    expect(queryVariables).toEqual({ offset: 0, limit: 10 })

    fireEvent.click(screen.getByText('next'))
    expect(queryVariables).toEqual({ offset: 10, limit: 10 })
})

test('an empty database gets a sentence, not an empty panel', () => {
    queryResult = {
        loading: false,
        data: { allComments: { totalAmount: 0, comments: [] } },
    }

    render(<Panel />)

    expect(screen.getByText('Zatím žádné komentáře.')).toBeTruthy()
})
