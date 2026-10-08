/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The game detail page is the surface the bug report was about: deleting "Test 2"
 * said it worked and the game stayed on screen. Two rules keep it gone —
 * `gameById` answering null has to hide the game (even though Apollo still holds
 * the cached fragment), and a game that *is* deleted has to say so and offer the
 * way back.
 *
 * The page is rendered against the shipped Czech locale with the child panels
 * stubbed, so the assertions are about the panel's own decisions and the wording
 * an editor actually reads.
 */

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
) as Record<string, unknown>

/** What the mocked `useQuery` answers; the tests below set it. */
let queryResult: Record<string, unknown> = {}

/** A settled query, with the cache lookup the panel does on the side. */
const answer = (gameById: unknown) => ({
    loading: false,
    data: { gameById },
    refetch: () => {},
    client: { readFragment: () => null },
})

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => queryResult,
    useMutation: () => [jest.fn(), { loading: false }],
    useApolloClient: () => ({ mutate: jest.fn() }),
}))

jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => loggedInUser,
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        gameDetail: () => '/',
        gameEdit: () => '/',
        homepage: () => '/',
    }),
}))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({ useShowToast: () => () => {} }))

/** Whoever the test signs in; the panel only reads it for the edit link. */
let loggedInUser: unknown = null

const stub = (name: string) => ({ [name]: () => <div /> })
const stubDefault = () => ({ default: () => <div /> })

jest.unstable_mockModule('../GameHeaderPanel', () => stub('GameHeaderPanel'))
jest.unstable_mockModule('../GameRatingPanel', () => stub('GameRatingPanel'))
jest.unstable_mockModule('../GamePagedCommentsPanel', () => stub('GamePagedCommentsPanel'))
jest.unstable_mockModule('../RatingsListPanel', () => stubDefault())
jest.unstable_mockModule('../../common/GameListPanel/GameListPanel', () => stub('GameListPanel'))
jest.unstable_mockModule('../../HomePage/EventListPanel', () => stub('EventListPanel'))
jest.unstable_mockModule('../../common/Tabs/Tabs', () => stub('Tabs'))
jest.unstable_mockModule('../../common/ConfirmationModal/ConfirmationModal', () => stubDefault())
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => stubDefault())

// The panel pulls its GraphQL documents in with require(); ESM jest has no require.
;(globalThis as unknown as { require: (path: string) => unknown }).require = () => ({})

let GameDetailPanel: typeof import('../GameDetailPanel').GameDetailPanel

beforeAll(async () => {
    GameDetailPanel = (await import('../GameDetailPanel')).GameDetailPanel
})

const deletedGame = { id: '1093', name: 'Test 2', deleted: true, allowedActions: ['Edit'] }
const liveGame = { id: '7', name: 'Živá hra', deleted: false, allowedActions: ['Edit', 'Delete'] }

test('a game the API no longer returns is not rendered from the cache', () => {
    // Apollo served the fragment from an earlier visit; the network answer is null.
    queryResult = answer(null)

    render(<GameDetailPanel gameId="1093" />)

    expect(screen.getByText(/Hra nenalezena/)).toBeTruthy()
    expect(screen.queryByText('Test 2')).toBeNull()
})

test('a deleted game is announced and offers the way back, not another delete', () => {
    queryResult = answer(deletedGame)

    render(<GameDetailPanel gameId="1093" />)

    expect(screen.getByText(/Tato hra je smazaná/)).toBeTruthy()
    expect(screen.getByText('Obnovit hru')).toBeTruthy()
    expect(screen.queryByText('Smazat hru')).toBeNull()
})

test('a live game offers edit and delete and no notice', () => {
    queryResult = answer(liveGame)

    render(<GameDetailPanel gameId="7" />)

    expect(screen.getByText('Smazat hru')).toBeTruthy()
    expect(screen.queryByText('Obnovit hru')).toBeNull()
    expect(screen.queryByText(/Tato hra je smazaná/)).toBeNull()
})
