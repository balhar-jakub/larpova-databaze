/**
 * @jest-environment jsdom
 */
/**
 * The comment edit modal: saves the markup via the mutation with the game
 * id, reports success/updated toasts, and passes saved=true to the parent.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const mutationCalls: Array<{ variables?: Record<string, unknown> }> = []
const toasts: Array<{ text: string; type: string }> = []
const savedCalls: Array<boolean | undefined> = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        mutationCalls.push(opts)
        return Promise.resolve({ data: { game: { updateComment: { id: 'c1' } } } })
    }, { loading: false }],
}))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({ useFocusInput: () => ({ current: null }) }))
jest.unstable_mockModule('../../common/form/richTextInputUtils', () => ({
    editorStateToHtml: (state: unknown) => (typeof state === 'string' ? state : ''),
}))
jest.unstable_mockModule('../../common/form/FormRichTextInputField', () => ({
    default: ({ name }: { name: string }) => {
        const { useField } = jest.requireActual('react-final-form') as typeof import('react-final-form')
        const { input } = useField(name)
        return <input name={name} data-testid="comment-input" onChange={input.onChange} value={input.value ?? ''} />
    },
}))
jest.unstable_mockModule('../../common/SubmitButton/SubmitButton', () => ({
    default: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}))

let EditCommentModal: typeof import('../EditCommentModal')['default']

beforeAll(async () => {
    EditCommentModal = (await import('../EditCommentModal')).default
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    savedCalls.length = 0
})

const renderModal = (oldText?: string) =>
    render(
        <EditCommentModal
            gameId="g1"
            oldText={oldText ?? ''}
            onHide={() => undefined}
            onLoad={() => undefined}
            onCommentSaved={() => { savedCalls.push(true) }}
        />,
    )

describe('EditCommentModal', () => {
    it('saves a new comment with the game id and toasts commentAdded', async () => {
        renderModal()

        fireEvent.change(screen.getByTestId('comment-input'), { target: { value: '<p>Nový komentář</p>' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(mutationCalls[0]?.variables).toEqual({ gameId: 'g1', comment: '<p>Nový komentář</p>' }))
        expect(toasts[0]).toEqual({ text: translate(cs, 'GameDetail.commentAdded'), type: 'success' })
        expect(savedCalls).toEqual([true])
    })

    it('toasts commentUpdated when editing an existing comment', async () => {
        renderModal('<p>Starý text</p>')

        fireEvent.change(screen.getByTestId('comment-input'), { target: { value: '<p>Upravený text</p>' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(toasts[0]?.text).toBe(translate(cs, 'GameDetail.commentUpdated')))
    })

    it('renders the modal title', () => {
        renderModal()
        expect(screen.getByText(translate(cs, 'EditCommentModal.title'))).toBeTruthy()
    })
})
