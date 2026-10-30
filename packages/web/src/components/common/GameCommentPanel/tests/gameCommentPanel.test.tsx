/**
 * @jest-environment jsdom
 */
/**
 * The game comment row: user with image and links, the upvote circle,
 * the sanitized comment text, the about-game footer and the visibility
 * toggle for the admins.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

const visibilityChanges: Array<{ id: string; isHidden: boolean }> = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('../../ProfileImage/ProfileImage', () => ({
    ProfileImage: () => <span data-testid="profile-image" />,
}))
jest.unstable_mockModule('../../UserLink/UserLink', () => ({
    default: ({ children }: { children?: React.ReactNode }) => <a href="/profile">{children}</a>,
}))
jest.unstable_mockModule('../../GameRatingBox/GameRatingBox', () => ({
    GameRatingBox: ({ rating }: { rating?: number }) => <span data-testid="rating">{rating}</span>,
}))
jest.unstable_mockModule('../../GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string; name?: string }; children?: React.ReactNode }) => (
        <a href={`/hra/${game.id}`}>{children ?? game.name}</a>
    ),
}))
jest.unstable_mockModule('../../Icons/Icons', () => ({
    IconEye: () => <span>eye</span>,
    IconEdit: () => <span>edit</span>,
    IconTrash: () => <span>trash</span>,
}))

let GameCommentPanel: typeof import('../GameCommentPanel').default

beforeAll(async () => {
    GameCommentPanel = (await import('../GameCommentPanel')).default
})

beforeEach(() => {
    cleanup()
    visibilityChanges.length = 0
})

const comment = {
    __typename: 'Comment',
    id: 'c1',
    added: '2026-05-01T10:00:00',
    amountOfUpvotes: 7,
    isHidden: false,
    comment: '<p>Skvělá hra!</p>',
    user: { __typename: 'User', id: 'u1', name: 'Jakub Balhar', nickname: 'balhar' },
    game: { __typename: 'Game', id: 'g1', name: 'Dračí doupě' },
}

describe('GameCommentPanel', () => {
    it('shows the user, the date, the upvotes and the sanitized text', () => {
        render(<GameCommentPanel comment={comment as never} loading={false} showVisibilityButton={false} onChangeCommentVisibility={undefined as never} />)

        expect(screen.getByText('balhar')).toBeTruthy()
        expect(screen.getByText('01.05.2026')).toBeTruthy()
        expect(screen.getByText('7')).toBeTruthy()
        expect(document.querySelector('p')!.innerHTML).toBe('<p>Skvělá hra!</p>')
        // The game footer names the commented game.
        expect(screen.getByText('Dračí doupě')).toBeTruthy()
    })

    it('toggles the comment visibility through the admin button', () => {
        render(
            <GameCommentPanel
                comment={comment as never}
                loading={false}
                showVisibilityButton
                onChangeCommentVisibility={(id, isHidden) => visibilityChanges.push({ id, isHidden })}
            />,
        )

        fireEvent.click(screen.getByText('eye'))
        expect(visibilityChanges).toEqual([{ id: 'c1', isHidden: true }])
    })

    it('renders with the dimmed look while loading', () => {
        render(
            <GameCommentPanel
                comment={comment as never}
                loading
                showVisibilityButton={false}
                onChangeCommentVisibility={undefined as never}
            />,
        )

        expect(screen.getByText('Skvělá hra!')).toBeTruthy()
    })

    it('answers the first word of the name when there is no nickname', () => {
        render(
            <GameCommentPanel
                comment={{ ...comment, user: { ...comment.user, nickname: null, name: 'Jozef Novák' } } as never}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
            />,
        )

        // The nickname slot shows the first word of the full name.
        expect(screen.getByText('Jozef')).toBeTruthy()
        expect(screen.getByText('Jozef Novák')).toBeTruthy()
    })

    it('hides the manage buttons unless the viewer can manage the comment', () => {
        const { rerender } = render(
            <GameCommentPanel
                comment={comment as never}
                loading={false}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
                canManage={false}
                onEditComment={() => undefined}
                onDeleteComment={() => undefined}
            />,
        )
        expect(screen.queryByText('edit')).toBeNull()
        expect(screen.queryByText('trash')).toBeNull()

        rerender(
            <GameCommentPanel
                comment={comment as never}
                loading={false}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
                canManage
                onEditComment={() => undefined}
                onDeleteComment={() => undefined}
            />,
        )
        expect(screen.getByText('edit')).toBeTruthy()
        expect(screen.getByText('trash')).toBeTruthy()
    })

    it('fires edit and delete with the comment id', () => {
        const events: string[] = []
        render(
            <GameCommentPanel
                comment={comment as never}
                loading={false}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
                canManage
                onEditComment={id => events.push(`edit:${id}`)}
                onDeleteComment={id => events.push(`delete:${id}`)}
            />,
        )

        fireEvent.click(screen.getByText('edit'))
        fireEvent.click(screen.getByText('trash'))
        expect(events).toEqual(['edit:c1', 'delete:c1'])
    })

    it('labels the manage buttons with the translated tooltips', () => {
        render(
            <GameCommentPanel
                comment={comment as never}
                loading={false}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
                canManage
                onEditComment={() => undefined}
                onDeleteComment={() => undefined}
            />,
        )

        expect(screen.getByTitle('Upravit váš komentář')).toBeTruthy()
        expect(screen.getByTitle('Smazat váš komentář')).toBeTruthy()
    })

    it('keeps the whole name in the nickname slot when there is no space', () => {
        render(
            <GameCommentPanel
                comment={{ ...comment, user: { ...comment.user, nickname: null, name: 'Bezmezery' } } as never}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
            />,
        )

        // A single-word name has no first word to cut — it renders whole in both slots.
        expect(screen.getAllByText('Bezmezery').length).toBe(2)
    })

    it('renders with an unparseable added date', () => {
        render(
            <GameCommentPanel
                comment={{ ...comment, added: 'not-a-date' } as never}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
            />,
        )

        // The date falls back to the epoch formatting instead of crashing.
        expect(screen.getByText('01.01.1970')).toBeTruthy()
    })

    it('renders with and without an image id on the user', () => {
        const { rerender } = render(
            <GameCommentPanel
                comment={{ ...comment, user: { ...comment.user, image: { __typename: 'Image', id: 'img1' } } } as never}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
            />,
        )
        expect(screen.getByTestId('profile-image')).toBeTruthy()

        rerender(
            <GameCommentPanel
                comment={{ ...comment, user: { ...comment.user, image: null } } as never}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
            />,
        )
        expect(screen.getByTestId('profile-image')).toBeTruthy()
    })

    it('renders a hidden comment with the visibility button active', () => {
        render(
            <GameCommentPanel
                comment={{ ...comment, isHidden: true } as never}
                showVisibilityButton
                onChangeCommentVisibility={() => undefined}
            />,
        )

        // The eye button renders for the editor; clicking toggles to visible.
        fireEvent.click(screen.getByText('eye'))
    })

    it('renders without the game footer when the comment has no game', () => {
        render(
            <GameCommentPanel
                comment={{ ...comment, game: undefined } as never}
                showVisibilityButton={false}
                onChangeCommentVisibility={() => undefined}
            />,
        )

        expect(screen.queryByText('Dračí doupě')).toBeNull()
        expect(screen.getByText('Skvělá hra!')).toBeTruthy()
    })
})
