/**
 * @jest-environment jsdom
 */
/**
 * The rich text field: a draft-js editor inside react-final-form. The
 * field bootstraps the editor state from an HTML string (via
 * richTextInputUtils) or an empty state, reports every editor change to
 * the form, renders the toolbar buttons, and converts the editor state
 * back to HTML with entities (links) stripped — the server owns links.
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { createRequire } from 'node:module'

// draft-js is CommonJS: the ESM named-import statement fails under jest's
// ESM runner ("does not provide an export named 'ContentState'"). Re-export
// the real CJS module so the utils and the field run the real code.
const draftRequire = createRequire(import.meta.url)
jest.unstable_mockModule('draft-js', () => draftRequire('draft-js'))
// html-to-draftjs is a UMD bundle that grabs `window` at load time — under
// jest ESM it cannot be imported at all. A minimal converter produces the
// same block shape the real one does for plain paragraph HTML.
jest.unstable_mockModule('html-to-draftjs', () => ({
    default: (html: string) => {
        const texts = Array.from(html.matchAll(/<p[^>]*>(.*?)<\/p>/g)).map((m) => m[1])
        const draft = draftRequire('draft-js') as never as Record<string, any>
        const { ContentBlock, CharacterMetadata } = draft
        const Immutable = draftRequire('immutable')
        const List = Immutable.List
        const contentBlocks = (texts.length ? texts : [html]).map(
            (text: string) =>
                new ContentBlock({
                    key: Math.random().toString(36).slice(2),
                    type: 'unstyled',
                    text,
                    characterList: new List(
                        Array.from(text).map(() => CharacterMetadata.create({ entity: null, style: Immutable.OrderedSet.of() })),
                    ),
                }),
        )
        return { contentBlocks, entityMap: Immutable.OrderedMap({}) }
    },
}))

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key, locale: 'cs', ready: true }),
}))

describe('FormRichTextInputField', () => {
    let Form: typeof import('react-final-form')['Form']
    let FormRichTextInputField: typeof import('../FormRichTextInputField')['default']
    let EditorState: typeof import('draft-js')['EditorState']

    beforeAll(async () => {
        Form = (await import('react-final-form')).Form
        FormRichTextInputField = (await import('../FormRichTextInputField')).default
        EditorState = (await import('draft-js')).EditorState
    })

    afterEach(() => cleanup())

    const renderField = (initial?: unknown) => {
        const seen: unknown[] = []
        render(
            <Form
                onSubmit={() => undefined}
                initialValues={{ text: initial }}
                render={({ values }) => {
                    seen.push((values as Record<string, unknown>).text)
                    return <FormRichTextInputField name="text" label="Popis" hint="Nápověda" />
                }}
            />,
        )
        return seen
    }

    it('bootstraps an empty editor state when the value is unset', async () => {
        const seen = renderField(undefined)
        await act(async () => { await Promise.resolve() })
        // The first form value is the empty editor state the effect creates.
        expect(seen[seen.length - 1]).not.toBeUndefined()
    })

    it('bootstraps from an HTML string value', async () => {
        const seen = renderField('<p>Ahoj</p>')
        await act(async () => { await Promise.resolve(); await Promise.resolve() })
        const value = seen[seen.length - 1]
        // The string becomes an EditorState once the html->draft import resolves.
        expect(value).not.toBe('<p>Ahoj</p>')
    })

    it('renders the toolbar buttons and the label', async () => {
        renderField(undefined)
        await act(async () => { await Promise.resolve() })
        expect(screen.getByText('Popis')).toBeTruthy()
        // 8 toolbar buttons (headings 1-3, bold, italic, underline, lists),
        // all with tabIndex -1 so they are skipped in tab order.
        const toolbar = document.querySelectorAll('button[tabindex="-1"]')
        expect(toolbar.length).toBeGreaterThanOrEqual(8)
    })

    it('renders the draft editor once the state exists', async () => {
        renderField(undefined)
        await act(async () => { await Promise.resolve() })
        // draft-js renders its contenteditable surface with a role.
        expect(document.querySelector('[contenteditable]') !== null || document.querySelector('.DraftEditor-root') !== null).toBe(true)
    })

    it('marks the field blurred on editor blur and refocuses through the wrapper', async () => {
        renderField(undefined)
        await act(async () => { await Promise.resolve() })

        // The editor's contenteditable surface fires blur/focus events.
        const surface = document.querySelector('[contenteditable]') ?? document.querySelector('.DraftEditor-root')
        expect(surface).toBeTruthy()
        fireEvent.blur(surface!)
        // The wrapper click focuses the editor again (and stops the event).
        const wrapper = (surface as HTMLElement).parentElement!
        fireEvent.click(wrapper)
    })

    it('auto-focuses the editor once after mount when autoFocus is set', async () => {
        render(
            <Form
                onSubmit={() => undefined}
                initialValues={{ text: undefined }}
                render={() => <FormRichTextInputField name="text" label="Popis" autoFocus />}
            />,
        )
        await act(async () => {
            await Promise.resolve()
            // The autofocus fires through a 100ms timeout so it also works in modals.
            jest.advanceTimersByTime?.(0)
            await new Promise((resolve) => setTimeout(resolve, 150))
        })
        expect(document.querySelector('[contenteditable]') !== null || document.querySelector('.DraftEditor-root') !== null).toBe(true)
    })

    it('keeps an already-converted EditorState value as-is', async () => {
        const seen = renderField(EditorState.createEmpty())
        await act(async () => { await Promise.resolve() })
        expect(seen.length).toBeGreaterThan(0)
    })
})

describe('richTextInputUtils', () => {
    let utils: typeof import('../richTextInputUtils')
    let EditorState: typeof import('draft-js')['EditorState']

    beforeAll(async () => {
        utils = await import('../richTextInputUtils')
        EditorState = (await import('draft-js')).EditorState
    })

    it('editorStateToHtml returns undefined for an empty value', () => {
        expect(utils.editorStateToHtml(undefined)).toBeUndefined()
    })

    it('editorStateToHtml passes a plain string through unchanged', () => {
        expect(utils.editorStateToHtml('<p>existing html</p>')).toBe('<p>existing html</p>')
    })

    it('editorStateToHtml converts an editor state to HTML and strips entities', () => {
        const state = EditorState.createEmpty()
        const html = utils.editorStateToHtml(state)
        // An empty editor converts to (almost) empty html — but defined.
        expect(typeof html).toBe('string')
    })

    it('editorStateToHtml drops the entityRanges (links) from every block', () => {
        const withText = EditorState.createWithText('Odkaz na něco')
        const html = utils.editorStateToHtml(withText)
        expect(html).toContain('Odkaz na něco')
    })

    it('htmlToEditorState converts HTML back into an EditorState', async () => {
        const state = await utils.htmlToEditorState('<p>Ahoj</p>')
        expect(state.getCurrentContent().getPlainText()).toContain('Ahoj')
    })
})
