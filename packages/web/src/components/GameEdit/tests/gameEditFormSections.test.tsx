/**
 * @jest-environment jsdom
 */
/**
 * The game edit form has two shapes on purpose. Adding a game shows only what a
 * game cannot be saved without (name, year, authors, description and the
 * required labels) plus one disclosure that reveals the rest, because the form
 * used to open with 56 controls and put "Uložit" 2.5 screens down; editing an
 * existing game opens expanded, because an editor looking for a field must not
 * have to find it behind a click first.
 *
 * Both directions are easy to break. A field validated by the form but moved
 * into the collapsed part reports "the form contains errors" about something the
 * visitor cannot see, and a field an editor needs that silently stays hidden is
 * the regression this change exists to avoid. The two groups that remain one
 * level deeper (the gallery / video / photo-credit trio and the ratings-and-
 * comments switches) are pinned too: they are used by 27 %, resp. 0.8 % of games.
 */
import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
) as Record<string, unknown>

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

// Only the mutations have to exist here; what a submit sends is covered by the
// API suite, and the pickers below are mocked out entirely.
jest.unstable_mockModule('@apollo/client', () => ({
    useMutation: () => [() => Promise.resolve({ data: undefined }), { loading: false }],
    useQuery: () => ({ data: undefined, loading: false }),
    useLazyQuery: () => [() => Promise.resolve({}), { loading: false, data: undefined }],
}))

jest.unstable_mockModule('src/hooks/useShowToast', () => ({ useShowToast: () => () => undefined }))

// draft-js is CommonJS and answers "does not provide an export named
// 'ContentState'" under the ESM jest run, so its two remaining importers in this
// form's graph are stubbed: the editor itself (already above) and the
// editor-state-to-HTML helper the submit path calls.
jest.unstable_mockModule('src/components/common/form/richTextInputUtils', () => ({ editorStateToHtml: () => '' }))

// Draft.js and the autocomplete pickers drag in the router and a modal stack
// that has nothing to do with which fields the form renders.
jest.unstable_mockModule('../../common/form/FormRichTextInputField', () => ({
    default: ({ name }: { name: string }) => <div data-testid={`richtext-${name}`} />,
}))
jest.unstable_mockModule('../AuthorsAutoCompleteField', () => ({
    default: ({ name, placeholder }: { name: string; placeholder: string }) => (
        <input name={name} placeholder={placeholder} readOnly />
    ),
}))
jest.unstable_mockModule('../GroupsAutoCompleteField', () => ({
    default: ({ name, placeholder }: { name: string; placeholder: string }) => (
        <input name={name} placeholder={placeholder} readOnly />
    ),
}))
jest.unstable_mockModule('../SeriesAutoCompleteField', () => ({
    default: ({ name, placeholder }: { name: string; placeholder: string }) => (
        <input name={name} placeholder={placeholder} readOnly />
    ),
}))

const requiredLabels = [{ id: '1', name: 'svět', description: '' }]
const optionalLabels = [{ id: '2', name: 'fantasy', description: '' }]

describe('GameEditForm sections', () => {
    let GameEditForm: typeof import('../GameEditForm')['default']

    beforeAll(async () => {
        GameEditForm = (await import('../GameEditForm')).default
    })

    afterEach(() => {
        cleanup()
    })

    const renderForm = (gameId?: string) =>
        render(
            <GameEditForm
                gameId={gameId}
                authorizedRequiredLabels={requiredLabels}
                authorizedOptionalLabels={optionalLabels}
                onGameSaved={() => undefined}
            />,
        )

    const expand = (label: string) => fireEvent.click(screen.getByText(label))

    it('adding a game shows only the fields the game cannot be saved without', () => {
        renderForm()

        expect(screen.getByText(/Hru můžete uložit i s minimem údajů/)).toBeTruthy()
        expect(screen.getByPlaceholderText('Název hry')).toBeTruthy()
        expect(screen.getByPlaceholderText('Rok vytvoření')).toBeTruthy()
        expect(screen.getByPlaceholderText('Autoři hry')).toBeTruthy()
        expect(screen.getByTestId('richtext-description')).toBeTruthy()
        expect(screen.getByText('Povinné štítky')).toBeTruthy()
        expect(screen.getByText('svět')).toBeTruthy()

        expect(screen.getByText('Zobrazit rozšiřující údaje')).toBeTruthy()
        expect(screen.getByText('Uložit')).toBeTruthy()

        // Everything else waits behind the disclosure.
        expect(screen.queryByPlaceholderText('Hráčů')).toBeNull()
        expect(screen.queryByPlaceholderText('Hodin')).toBeNull()
        expect(screen.queryByPlaceholderText('Webová stránka')).toBeNull()
        expect(screen.queryByText('Volitelné štítky')).toBeNull()
        expect(screen.queryByText('Nový štítek')).toBeNull()
    })

    it('reveals the rest in one step and keeps the required labels in place', () => {
        renderForm()
        expand('Zobrazit rozšiřující údaje')

        expect(screen.getByPlaceholderText('Skupiny podílející se na hře')).toBeTruthy()
        expect(screen.getByPlaceholderText('Hráčů')).toBeTruthy()
        expect(screen.getByPlaceholderText('Hodin')).toBeTruthy()
        expect(screen.getByPlaceholderText('Webová stránka')).toBeTruthy()
        expect(screen.getByText('Volitelné štítky')).toBeTruthy()
        expect(screen.getByText('fantasy')).toBeTruthy()
        expect(screen.getByText('Nový štítek')).toBeTruthy()

        // The required half stayed where it was, and the disclosure is spent.
        expect(screen.getByText('Povinné štítky')).toBeTruthy()
        expect(screen.getByText('svět')).toBeTruthy()
        expect(screen.queryByText('Zobrazit rozšiřující údaje')).toBeNull()

        // The two groups almost no game uses are one level deeper still.
        expect(screen.queryByPlaceholderText('Autor fotografií')).toBeNull()
        expect(screen.queryByText('Zakázat hodnocení')).toBeNull()

        expand('Fotogalerie, video a autor fotografií')
        expect(screen.getByPlaceholderText('Autor fotografií')).toBeTruthy()
        expect(screen.getByPlaceholderText('Video ze hry')).toBeTruthy()

        expand('Zakázat hodnocení a komentování')
        expect(screen.getByText('Zakázat hodnocení')).toBeTruthy()
        expect(screen.getByText('Zakázat komentování')).toBeTruthy()
    })

    it('editing an existing game opens expanded', () => {
        renderForm('7')

        expect(screen.getByPlaceholderText('Hráčů')).toBeTruthy()
        expect(screen.getByPlaceholderText('Webová stránka')).toBeTruthy()
        expect(screen.queryByText('Zobrazit rozšiřující údaje')).toBeNull()
    })

    it('reports the required fields of the collapsed form on a failed submit', () => {
        renderForm()
        fireEvent.click(screen.getByText('Uložit'))

        // Nothing to attach the message to is NOT allowed to happen: every
        // validated field of the collapsed state must be able to show its error.
        expect(screen.getAllByText('Povinná hodnota').length).toBeGreaterThan(0)
        expect(screen.queryByPlaceholderText('Hráčů')).toBeNull()
    })
})
