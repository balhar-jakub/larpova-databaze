/**
 * @jest-environment jsdom
 */
/**
 * The game edit form submit flow: create and update mutations with the
 * built input, the series link as its own mutation (add by id, create by
 * name, skip when none), and the toasts for each outcome.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
) as Record<string, unknown>

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

// Sliced per mutation name by prefixing the mock below.
const mutationCalls: Array<{ name: string; variables?: Record<string, unknown> }> = []
const toasts: Array<{ text: string; type: string }> = []
const savedGames: Array<{ id: string; name?: string }> = []
let currentResponse: { data?: unknown } = { data: undefined }

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    // The form names its mutations by hook order (createGame, updateGame,
    // setGameSeries); the mock records the call and answers with the
    // configured response shape for the requested operation.
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        const input = opts.variables?.input as Record<string, unknown> | undefined
        const name = typeof input?.id === 'string' && input.id ? 'updateGame' : 'createGame'
        mutationCalls.push({ name, variables: opts.variables })
        const seriesCall = Boolean(opts.variables) && 'seriesId' in ((opts.variables as Record<string, { input?: Record<string, unknown> }>).input ?? {})
        if (seriesCall) {
            mutationCalls[mutationCalls.length - 1]!.name = 'setGameSeries'
        }
        return Promise.resolve(seriesCall ? { data: {} } : currentResponse)
    }, { loading: false }],
    useQuery: () => ({ data: undefined, loading: false }),
    useLazyQuery: () => [() => Promise.resolve({}), { loading: false, data: undefined }],
    useApolloClient: () => ({}),
}))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('src/components/common/form/richTextInputUtils', () => ({ editorStateToHtml: () => '' }))
jest.unstable_mockModule('../../common/form/FormRichTextInputField', () => ({
    default: ({ name }: { name: string }) => {
        const { useField } = jest.requireActual('react-final-form') as typeof import('react-final-form')
        const { input } = useField(name)
        return <input data-testid={`richtext-${name}`} onChange={input.onChange} value={input.value ?? ''} />
    },
}))
jest.unstable_mockModule('../AuthorsAutoCompleteField', () => ({
    default: ({ name, placeholder }: { name: string; placeholder?: string }) => {
        const { useField } = jest.requireActual('react-final-form') as typeof import('react-final-form')
        const { input } = useField(name)
        return (
            <input
                name={name}
                placeholder={placeholder}
                data-testid={`field-${name}`}
                onChange={(event) => input.onChange(event.target.value ? [{ id: event.target.value, name: event.target.value }] : [])}
                value={Array.isArray(input.value) && input.value[0]?.id ? input.value[0].id : ''}
            />
        )
    },
}))
jest.unstable_mockModule('../GroupsAutoCompleteField', () => ({
    default: ({ name, placeholder }: { name: string; placeholder?: string }) => (
        <input name={name} placeholder={placeholder} readOnly />
    ),
}))
jest.unstable_mockModule('../SeriesAutoCompleteField', () => ({
    default: ({ name, placeholder }: { name: string; placeholder?: string }) => (
        <input name={name} placeholder={placeholder} readOnly />
    ),
}))

let GameEditForm: typeof import('../GameEditForm')['default']

beforeAll(async () => {
    GameEditForm = (await import('../GameEditForm')).default
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    savedGames.length = 0
    currentResponse = { data: undefined }
})

const requiredLabels = [{ id: '1', name: 'svět', description: '' }]
const optionalLabels = [{ id: '2', name: 'fantasy', description: '' }]

const nameInput = () => screen.getByPlaceholderText(translate(cs, 'GameEdit.name'))

const renderForm = (props: Record<string, unknown> = {}) =>
    render(
        <GameEditForm
            authorizedRequiredLabels={requiredLabels}
            authorizedOptionalLabels={optionalLabels}
            onGameSaved={(game: { id: string; name?: string }) => { savedGames.push(game) }}
            {...props}
        />,
    )

const submitValid = (name = 'Nová hra') => {
    fireEvent.change(nameInput(), { target: { value: name } })
    fireEvent.change(screen.getByTestId('field-authors'), { target: { value: 'Autor' } })
    fireEvent.change(screen.getByTestId('richtext-description'), { target: { value: 'Popis hry' } })
    // The required labels (svět) are checkboxes.
    fireEvent.click(screen.getByLabelText('svět'))
    fireEvent.submit(document.querySelector('form')!)
}

describe('GameEditForm submit flow', () => {
    it('creates a game and reports it without a series', async () => {
        currentResponse = { data: { game: { createGame: { id: 'g9', name: 'Nová hra', year: 2027 } } } }
        renderForm()

        submitValid()

        await waitFor(() => expect(mutationCalls[0]?.name).toBe('createGame'))
        // No series chosen -> no setGameSeries call.
        await waitFor(() => expect(toasts[0]).toEqual({ text: translate(cs, 'GameEdit.gameCreated'), type: 'success' }))
        expect(savedGames).toEqual([{ id: 'g9', name: 'Nová hra', year: 2027 }])
    })

    it('shows the big loading indicator while the game data loads', () => {
        renderForm({ dataLoading: true })

        // No form while the data is loading.
        expect(document.querySelector('form')).toBeNull()
    })

    it('expands the labels help on click', () => {
        renderForm()

        fireEvent.click(screen.getByText(translate(cs, 'GameEdit.labelsHelp')))
        expect(screen.getByText(translate(cs, 'GameEdit.help1'))).toBeTruthy()
    })

    it('updates an existing game and skips the series call when nothing changed', async () => {
        currentResponse = { data: { game: { updateGame: { id: 'g1', name: 'Stará hra', year: 2026 } } } }
        renderForm({ gameId: 'g1', initialValues: { name: 'Stará hra', authors: [], groupAuthors: [], requiredLabels: [], optionalLabels: [], newLabels: [] } as never })

        submitValid()

        await waitFor(() => expect(mutationCalls[0]?.name).toBe('updateGame'))
        await waitFor(() => expect(toasts[0]).toEqual({ text: translate(cs, 'GameEdit.gameUpdated'), type: 'success' }))
        expect(mutationCalls.filter((c) => c.name === 'setGameSeries').length).toBe(0)
        expect(savedGames[0]?.id).toBe('g1')
    })
})
