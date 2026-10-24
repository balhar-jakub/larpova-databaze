/**
 * @jest-environment jsdom
 */
/**
 * The detail game list: renders one light-variant base data panel per
 * game.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

const seen: Array<{ id: string; variant?: string }> = []

jest.unstable_mockModule('../../GameBaseDataPanel/GameBaseDataPanel', () => ({
    GameBaseDataPanel: ({ game, variant }: { game: { id: string }; variant?: string }) => {
        seen.push({ id: game.id, variant })
        return <div data-testid={`game-${game.id}`} />
    },
}))

let DetailGameList: typeof import('../DetailGameList').default

beforeAll(async () => {
    DetailGameList = (await import('../DetailGameList')).default
})

beforeEach(() => {
    cleanup()
    seen.length = 0
})

describe('DetailGameList', () => {
    it('renders every game in the light variant', () => {
        render(
            <DetailGameList
                games={[
                    { id: 'g1' } as never,
                    { id: 'g2' } as never,
                ]}
            />,
        )

        expect(seen).toEqual([
            { id: 'g1', variant: 'light' },
            { id: 'g2', variant: 'light' },
        ])
        expect(screen.getByTestId('game-g1')).toBeTruthy()
        expect(screen.getByTestId('game-g2')).toBeTruthy()
    })
})
