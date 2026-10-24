/**
 * @jest-environment jsdom
 */
/**
 * The base comment panel of the homepage: shows the commenting user, the
 * game it is about with links to both, the rating, the formatted date,
 * the comment text and the "read more" link.
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

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('../../common/ProfileImage/ProfileImage', () => ({
    ProfileImage: () => <div data-testid="profile-image" />,
}))
jest.unstable_mockModule('../../common/GameRatingBox/GameRatingBox', () => ({
    GameRatingBox: ({ rating }: { rating?: number }) => <div data-testid="rating">{rating}</div>,
    ratingStyles: {},
}))
jest.unstable_mockModule('../../common/UserLink/UserLink', () => ({
    default: ({ userId, children }: { userId: string; children: React.ReactNode }) => (
        <a href={`/profile?id=${userId}`}>{children}</a>
    ),
}))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string }; children?: React.ReactNode }) => (
        <a href={`/hra/${game.id}`}>{children ?? game.name}</a>
    ),
}))

let BaseCommentPanel: typeof import('../BaseCommentPanel').BaseCommentPanel

beforeAll(async () => {
    BaseCommentPanel = (await import('../BaseCommentPanel')).BaseCommentPanel
})

beforeEach(() => cleanup())

const comment = {
    __typename: 'Comment',
    id: 'c1',
    commentAsText: 'Skvělá hra',
    added: '2026-05-01T12:00:00.000Z',
    rating: 5,
    user: { id: 'u1', name: 'Jakub', image: null },
    game: { id: 'g1', name: 'Dračí doupě' },
}

describe('BaseCommentPanel', () => {
    it('links the user and the game the comment is about', () => {
        render(<BaseCommentPanel comment={comment as never} />)

        expect(screen.getByText('Jakub').closest('a')?.getAttribute('href')).toBe('/profile?id=u1')
        expect(screen.getByText('Dračí doupě').closest('a')?.getAttribute('href')).toBe('/hra/g1')
        expect(screen.getByText(translate(cs, 'HomePage.commentAbout'))).toBeTruthy()
    })

    it('shows the comment text with the date and the read-more link', () => {
        render(<BaseCommentPanel comment={comment as never} />)

        expect(screen.getByText(/Skvělá hra/)).toBeTruthy()
        expect(screen.getByText('01.05.2026')).toBeTruthy()
        expect(screen.getByText(translate(cs, 'HomePage.commentMore'))).toBeTruthy()
    })

    it('renders the sparse arms: no added date parse, no user image, no game ratings', () => {
        render(
            <BaseCommentPanel
                comment={
                    {
                        __typename: 'Comment',
                        id: 'c2',
                        commentAsText: null,
                        added: 'not-a-date',
                        user: { id: 'u2', name: 'Bez obrázku' },
                        game: { id: 'g2', name: 'Hra bez hodnocení' },
                    } as never
                }
            />,
        )

        // The unparseable date falls back to the epoch; the rating falls back to 0;
        // the user without an image renders as-is.
        expect(screen.getByText('Bez obrázku')).toBeTruthy()
        expect(screen.getByTestId('rating').textContent).toBe('')
        expect(screen.getByText('01.01.1970')).toBeTruthy()
    })
})
