/**
 * @jest-environment jsdom
 */
/**
 * The game edit page shell: one tab, lazy form, initial values derived
 * from the loaded game, and the redirect to the game detail after save.
 * Also covers GameEditPagePanel's toInitialValues mappers.
 */
import React from 'react'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let queryData: Record<string, unknown> | undefined
let pushedRoute = ''

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: queryData, loading: false }),
    useApolloClient: () => ({}),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = {
            gameDetail: (id: string, name?: string | null) => ({ href: `/gameDetail?id=${id}`, as: `/larp/${id}-${name}` }),
        }
        return { ...routes, push: (r: { as: string }) => { pushedRoute = r.as } }
    },
}))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/Tabs/Tabs', () => ({
    Tabs: ({ tabs }: { tabs: Array<{ title: string }> }) => <div data-testid="tabs">{tabs[0]?.title}</div>,
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../GameEditForm', () => ({
    default: ({ onGameSaved, initialValues }: { onGameSaved: (g: { id: string; name?: string | null }) => void; initialValues?: unknown }) => (
        <div data-testid="game-edit-form" data-has-initials={String(Boolean(initialValues))}>
            <button type="button" onClick={() => onGameSaved({ id: 'g7', name: 'Uložená hra' })}>save-game</button>
        </div>
    ),
}))

let GameEditPagePanel: typeof import('../GameEditPagePanel')['default']

beforeAll(async () => {
    GameEditPagePanel = (await import('../GameEditPagePanel')).default
})

beforeEach(() => {
    cleanup()
    pushedRoute = ''
    queryData = undefined
})

describe('GameEditPagePanel', () => {
    it('renders the add-game tab and the lazy form for a new game', async () => {
        render(<GameEditPagePanel />)

        expect(screen.getByTestId('tabs').textContent).toBe(translate(cs, 'GameEdit.addGameTab'))
        expect(await screen.findByTestId('game-edit-form')).toBeTruthy()
        expect(screen.getByTestId('game-edit-form').dataset.hasInitials).toBe('false')
    })

    it('derives initial values from the loaded game when editing', async () => {
        queryData = {
            gameById: {
                __typename: 'Game',
                id: 'g7',
                name: 'Existující hra',
                authors: [{ __typename: 'User', id: 'u1', name: 'Autor', nickname: null }],
                groupAuthor: [],
                labels: [],
            },
        }
        render(<GameEditPagePanel gameId="g7" />)

        expect(screen.getByTestId('tabs').textContent).toBe(translate(cs, 'GameEdit.editGameTab'))
        await waitFor(() => expect(screen.getByTestId('game-edit-form').dataset.hasInitials).toBe('true'))
    })

    it('redirects to the game detail after the form saves', async () => {
        render(<GameEditPagePanel />)

        fireEvent.click(await screen.findByTestId('game-edit-form').then((f) => f.querySelector('button')!))
        await act(async () => { await Promise.resolve() })
        expect(pushedRoute).toBe('/larp/g7-Uložená hra')
    })

    it('maps a sparse game: null name, no nickname, nameless group and series', async () => {
        queryData = {
            gameById: {
                __typename: 'Game',
                id: 'g8',
                name: null,
                description: null,
                authors: [{ __typename: 'User', id: 'u2', name: 'Autor bez nicku', nickname: null }],
                groupAuthor: [{ __typename: 'Group', id: 'gr1', name: null }],
                labels: [],
                web: null,
                photoAuthor: null,
                galleryURL: null,
                series: { __typename: 'Series', id: 's1', name: null, amountOfGames: 4 },
                year: null,
                players: null,
                womenRole: null,
                menRole: null,
                bothRole: null,
                hours: null,
                days: null,
                ratingsDisabled: null,
                commentsDisabled: null,
            },
        }
        render(<GameEditPagePanel gameId="g8" />)

        // toInitialValues survives every null: the form receives initial values
        // (not undefined), so the panel is ready for editing.
        await waitFor(() => expect(screen.getByTestId('game-edit-form').dataset.hasInitials).toBe('true'))
    })
})
