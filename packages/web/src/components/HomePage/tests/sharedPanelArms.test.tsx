/**
 * @jest-environment jsdom
 */
/**
 * Branch arms of two small shared panels:
 * - HomeAuthoredCommentsPanel: the empty state, a comment without a game,
 *   without a user name, and without a date.
 * - GameBaseDataPanel: stat labels on/off, a variant + className combo,
 *   bare-number rendering when labels are off.
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

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('../../common/GameLink/GameLink', () => ({
    GameLink: ({ game, children }: { game: { id: string }; children?: React.ReactNode }) => (
        <a href={`/larp/${game.id}`}>{children}</a>
    ),
}))
jest.unstable_mockModule('../../common/GameRatingBox/GameRatingBox', () => ({
    GameRatingBox: ({ amountOfRatings }: { amountOfRatings?: number }) => <span data-testid="rating">{amountOfRatings}</span>,
    ratingStyles: {},
}))
jest.unstable_mockModule('../../common/Icons/Icons', () => ({
    IconUser: () => <span>u</span>,
    IconComment: () => <span>c</span>,
    IconRating: () => <span>r</span>,
}))

let HomeAuthoredCommentsPanel: typeof import('../HomeAuthoredCommentsPanel').HomeAuthoredCommentsPanel
let GameBaseDataPanel: typeof import('../../common/GameBaseDataPanel/GameBaseDataPanel').GameBaseDataPanel

beforeAll(async () => {
    HomeAuthoredCommentsPanel = (await import('../HomeAuthoredCommentsPanel')).HomeAuthoredCommentsPanel
    GameBaseDataPanel = (await import('../../common/GameBaseDataPanel/GameBaseDataPanel')).GameBaseDataPanel
})

beforeEach(() => cleanup())

describe('HomeAuthoredCommentsPanel arms', () => {
    it('answers the empty state when there is nothing to read', () => {
        render(<HomeAuthoredCommentsPanel />)

        expect(screen.getByText(translate(cs, 'HomePage.authoredCommentsNone'))).toBeTruthy()
    })

    it('renders a sparse comment: no game, no user name, no date', () => {
        render(
            <HomeAuthoredCommentsPanel
                comments={[{ id: 'c1', game: null, user: null, added: null, commentAsText: 'Krátká recenze' } as never]}
            />,
        )

        expect(screen.getByText('Krátká recenze')).toBeTruthy()
        // Without a game the head line stays absent — no author, no date.
        expect(screen.queryByText(/autor/)).toBeNull()
        expect(document.body.textContent).not.toContain('NaN')
    })

    it('names the comment author and the date when both exist', () => {
        render(
            <HomeAuthoredCommentsPanel
                comments={[{
                    id: 'c2',
                    game: { id: 'g1', name: 'Hra' },
                    user: { name: 'Tara Rees' },
                    added: '2026-08-25T19:18:26.000Z',
                    commentAsText: 'Milý larp.',
                } as never]}
            />,
        )

        expect(document.body.textContent).toContain('Tara Rees')
        expect(document.body.textContent).toContain('25.08.2026')
    })
})

describe('GameBaseDataPanel arms', () => {
    const game = {
        id: 'g1',
        name: 'Legie',
        players: 10,
        amountOfComments: 3,
        amountOfRatings: 6,
    }

    it('renders bare numbers when the stat labels are off', () => {
        render(<GameBaseDataPanel game={game as never} variant="light" />)

        expect(screen.getByText('10')).toBeTruthy()
        expect(screen.getByText('3')).toBeTruthy()
        expect(screen.getByText('6 x')).toBeTruthy()
    })

    it('renders labelled stats and survives a null player count', () => {
        render(<GameBaseDataPanel game={{ ...game, players: null } as never} variant="light" showStatLabels />)

        expect(screen.getByText(translate(cs, 'Game.players', { count: 0 }))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'Catalog.card.comments', { count: 3 }))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'Catalog.card.ratings', { count: 6 }))).toBeTruthy()
    })
})

describe('HomePersonalPanel and HomeEmptyPanel null-name arms', () => {
    let HomePersonalPanel: typeof import('../HomePersonalPanel').HomePersonalPanel
    let HomeEmptyPanel: typeof import('../HomeEmptyPanel').HomeEmptyPanel

    beforeAll(async () => {
        HomePersonalPanel = (await import('../HomePersonalPanel')).HomePersonalPanel
        HomeEmptyPanel = (await import('../HomeEmptyPanel')).HomeEmptyPanel
    })

    it('greets a nameless visitor and renders the band without counts', () => {
        render(<HomePersonalPanel name={undefined} playedCount={undefined} authoredCount={undefined} commentsCount={undefined} toFinishCount={undefined} />)

        // The name falls back to the empty string; the counts line stays absent.
        expect(document.body.textContent).not.toContain('NaN')
        expect(document.body.textContent).not.toContain('undefined')
        cleanup()

        render(<HomeEmptyPanel name={undefined} />)
        expect(document.body.textContent).not.toContain('NaN')
    })
})

