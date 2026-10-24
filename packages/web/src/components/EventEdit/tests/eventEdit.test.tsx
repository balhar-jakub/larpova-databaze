/**
 * @jest-environment jsdom
 */
/**
 * The event edit cluster: the form's create/update mutations with toast +
 * redirect, validation rules (required dates, paired times, date/time
 * mismatch, registration URL rules), the expand/collapse of additional
 * fields, the UPCOMING-only registration-opens fields, and the panel's
 * tab flow for inline game creation.
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

// draft-js and html-to-draftjs are CJS/UMD — re-export and stub them like the
// richTextInput suite does, so formUtils' editorStateToHtml import resolves.
import { createRequire } from 'node:module'
const draftRequire = createRequire(import.meta.url)
jest.unstable_mockModule('draft-js', () => draftRequire('draft-js'))
jest.unstable_mockModule('draft-js-buttons', () => draftRequire('draft-js-buttons'))
jest.unstable_mockModule('react-bootstrap-icons', () => draftRequire('react-bootstrap-icons'))
jest.unstable_mockModule('react-datepicker', () => ({
    registerLocale: () => undefined,
    default: ({ customInput, placeholderText }: { customInput?: React.ReactElement; placeholderText?: string }) =>
        customInput ? React.cloneElement(customInput, { placeholder: placeholderText }) : <input placeholder={placeholderText} />,
}))
jest.unstable_mockModule('html-to-draftjs', () => ({
    default: (html: string) => {
        const texts = Array.from(html.matchAll(/<p[^>]*>(.*?)<\/p>/g)).map((m) => m[1])
        const draft = draftRequire('draft-js') as never as Record<string, any>
        const Immutable = draftRequire('immutable')
        const contentBlocks = (texts.length ? texts : [html]).map(
            (text: string) =>
                new draft.ContentBlock({
                    key: Math.random().toString(36).slice(2),
                    type: 'unstyled',
                    text,
                    characterList: new Immutable.List(
                        Array.from(text).map(() => draft.CharacterMetadata.create({ entity: null, style: Immutable.OrderedSet.of() })),
                    ),
                }),
        )
        return { contentBlocks, entityMap: Immutable.OrderedMap({}) }
    },
}))

let mutationResult: Promise<{ data?: unknown }> = Promise.resolve({ data: {} })
const mutationCalls: Array<{ variables?: Record<string, unknown> }> = []
const toasts: Array<{ text: string; type: string }> = []
let pushedRoute = ''

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: undefined, loading: false, refetch: () => Promise.resolve({ data: { games: { byQuery: [] } } }) }),
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        mutationCalls.push(opts)
        return mutationResult
    }, { loading: false }],
}))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = {
            eventDetail: (id: string, name: string) => ({ href: `/udalost/${id}`, as: `/udalost/${id}-${name}` }),
            gameDetail: (id: string, name: string) => ({ href: `/larp/${id}`, as: `/larp/${id}-${name}` }),
        }
        return { ...routes, push: (url: string | { as?: string }) => { pushedRoute = typeof url === 'string' ? url : (url.as ?? '') } }
    },
}))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({
    useFocusInput: () => ({ current: null }),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('../../common/form/FormAutoCompleteField', () => ({
    default: ({ placeholder, onCreateNew }: { placeholder?: string; onCreateNew: () => void }) => (
        <div>
            <input placeholder={placeholder} />
            <button type="button" onClick={onCreateNew} data-testid="create-new-game" />
        </div>
    ),
}))
jest.unstable_mockModule('../../common/LabelsEditColumn/LabelsEditColumn', () => ({
    default: () => <div data-testid="labels-column" />,
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../common/SubmitButton/SubmitButton', () => ({
    default: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/Tabs/Tabs', () => ({
    Tabs: ({ tabs }: { tabs: Array<{ key: string; title: string }> }) => (
        <div data-testid="tabs">{tabs.map((tab) => tab.title).join('|')}</div>
    ),
}))
jest.unstable_mockModule('../../GameEdit/GameEditForm', () => ({
    default: ({ onGameSaved, onFormCanceled }: { onGameSaved: (g: { id: string; name: string; year: number }) => void; onFormCanceled: () => void }) => (
        <div data-testid="game-edit-form">
            <button type="button" onClick={() => onGameSaved({ id: 'g1', name: 'Nová hra', year: 2027 })}>save game</button>
            <button type="button" onClick={onFormCanceled}>cancel game</button>
        </div>
    ),
}))
jest.unstable_mockModule('../../GameEdit/GameEditPagePanel', () => ({
    default: () => <div />,
}))

let EventEditForm: typeof import('../EventEditForm')['default']
let EventEditPanel: typeof import('../EventEditPanel')['default']

beforeAll(async () => {
    EventEditForm = (await import('../EventEditForm')).default
    EventEditPanel = (await import('../EventEditPanel')).default
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    pushedRoute = ''
    mutationResult = Promise.resolve({ data: {} })
})

const baseValues = {
    name: 'Nová událost',
    fromDate: new Date(2027, 5, 4),
    fromTime: '10:00',
    toDate: new Date(2027, 5, 6),
    toTime: '18:00',
    registrationStatus: '',
    loc: 'Praha',
    games: [{ id: 'g1', name: 'Hra', itemLabel: 'Hra (2027)' }],
    requiredLabels: [],
    optionalLabels: [],
    newLabels: [],
}

describe('EventEditForm', () => {
    const renderForm = (over: Record<string, unknown> = {}) =>
        render(<EventEditForm initialValues={{ ...baseValues, ...over } as never} onCreateNewGame={() => undefined} />)

    it('shows the loading state while the event data loads', () => {
        render(<EventEditForm dataLoading initialValues={baseValues as never} onCreateNewGame={() => undefined} />)
        expect(screen.getByText('loading')).toBeTruthy()
    })

    it('renders the contracted form for a new event with the expand button', () => {
        renderForm()
        expect(screen.getByPlaceholderText(translate(cs, 'EventEdit.name'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'EventEdit.showFields'))).toBeTruthy()
        // The additional fields are hidden until expanded.
        expect(screen.queryByPlaceholderText(translate(cs, 'EventEdit.amountOfPlayers'))).toBeNull()
    })

    it('expands the additional fields on demand', async () => {
        renderForm()
        fireEvent.click(screen.getByText(translate(cs, 'EventEdit.showFields')))
        expect(screen.getByPlaceholderText(translate(cs, 'EventEdit.amountOfPlayers'))).toBeTruthy()
        expect(screen.getByPlaceholderText(translate(cs, 'EventEdit.web'))).toBeTruthy()
    })

    it('starts expanded when editing an existing event', () => {
        render(<EventEditForm eventId="e1" initialValues={baseValues as never} onCreateNewGame={() => undefined} />)
        expect(screen.getByPlaceholderText(translate(cs, 'EventEdit.amountOfPlayers'))).toBeTruthy()
    })

    it('submits the create mutation and redirects on success', async () => {
        mutationResult = Promise.resolve({ data: { event: { createEvent: { id: 'e42', name: 'Nová událost' } } } })
        renderForm()

        fireEvent.submit(document.querySelector('form')!)
        await waitFor(() => expect(pushedRoute).toBe('/udalost/e42-Nová událost'))
        expect(toasts[0]?.type).toBe('success')
        const input = mutationCalls[0]?.variables?.input as Record<string, unknown>
        expect(input.name).toBe('Nová událost')
        expect(input.games).toEqual(['g1'])
    })

    it('submits the update mutation with the event id', async () => {
        mutationResult = Promise.resolve({ data: { event: { updateEvent: { id: 'e42', name: 'Stará událost' } } } })
        render(<EventEditForm eventId="e42" initialValues={{ ...baseValues, name: 'Stará událost' } as never} onCreateNewGame={() => undefined} />)

        fireEvent.submit(document.querySelector('form')!)
        await waitFor(() => expect(pushedRoute).toBe('/udalost/e42-Stará událost'))
        const input = mutationCalls[0]?.variables?.input as Record<string, unknown>
        expect(input.id).toBe('e42')
    })

    it('shows the registration-opens fields only for UPCOMING status', async () => {
        render(<EventEditForm eventId="e1" initialValues={{ ...baseValues, registrationStatus: 'UPCOMING' } as never} onCreateNewGame={() => undefined} />)
        expect(screen.getByPlaceholderText(translate(cs, 'EventEdit.registrationOpensDate'))).toBeTruthy()

        fireEvent.change(screen.getByLabelText(translate(cs, 'EventEdit.registrationStatus')), { target: { value: 'OPEN' } })
        await act(async () => { await Promise.resolve() })
        expect(screen.queryByPlaceholderText(translate(cs, 'EventEdit.registrationOpensDate'))).toBeNull()
    })

    it('requires a URL when registration is OPEN and rejects non-http URLs', async () => {
        render(<EventEditForm eventId="e1" initialValues={{ ...baseValues, registrationStatus: 'OPEN', registrationUrl: 'javascript:' } as never} onCreateNewGame={() => undefined} />)

        fireEvent.submit(document.querySelector('form')!)
        // Validation message appears; no mutation has been sent.
        expect(mutationCalls.length).toBe(0)
        expect(screen.getByText(translate(cs, 'Errors.invalidUrl'))).toBeTruthy()
    })

    it('reports paired-time and date-mismatch errors', async () => {
        render(<EventEditForm eventId="e1" initialValues={{ ...baseValues, fromTime: undefined } as never} onCreateNewGame={() => undefined} />)
        fireEvent.submit(document.querySelector('form')!)
        expect(screen.getByText(translate(cs, 'EventEdit.fillBothTimes'))).toBeTruthy()

        cleanup()
        render(<EventEditForm eventId="e1" initialValues={{ ...baseValues, toDate: new Date(2027, 4, 1) } as never} onCreateNewGame={() => undefined} />)
        fireEvent.submit(document.querySelector('form')!)
        expect(screen.getByText(translate(cs, 'EventEdit.dateMismatch'))).toBeTruthy()
    })
})

describe('EventEditPanel', () => {
    it('renders the event form only with the add tab', async () => {
        render(<EventEditPanel />)
        expect(screen.getByTestId('tabs').textContent).toBe(translate(cs, 'EventEdit.addEventTab'))
        // The form is lazy-loaded: it appears after a tick.
        expect(await screen.findByPlaceholderText(translate(cs, 'EventEdit.name'))).toBeTruthy()
    })

    it('hides the form while creating a game and adds the game tab', async () => {
        render(<EventEditPanel />)
        // The games field (with the create-new-game button) sits in the
        // expanded section - expand the form first.
        fireEvent.click(await screen.findByText(translate(cs, 'EventEdit.showFields')))
        fireEvent.click(screen.getByTestId('create-new-game'))
        await act(async () => { await Promise.resolve() })
        expect(screen.getByTestId('game-edit-form')).toBeTruthy()
        expect(screen.getByTestId('tabs').textContent).toContain(translate(cs, 'EventEdit.addGameTab'))
        // The collapsed event form renders nothing while a game is added.
        expect(screen.queryByPlaceholderText(translate(cs, 'EventEdit.name'))).toBeNull()
    })

    it('returns to the event form after saving the game', async () => {
        render(<EventEditPanel />)
        fireEvent.click(await screen.findByText(translate(cs, 'EventEdit.showFields')))
        fireEvent.click(screen.getByTestId('create-new-game'))
        await act(async () => { await Promise.resolve() })

        fireEvent.click(screen.getByText('save game'))
        await act(async () => { await Promise.resolve() })
        expect(screen.queryByTestId('game-edit-form')).toBeNull()
        expect(screen.getByPlaceholderText(translate(cs, 'EventEdit.name'))).toBeTruthy()
    })

    it('returns to the event form on cancel too', async () => {
        render(<EventEditPanel />)
        fireEvent.click(await screen.findByText(translate(cs, 'EventEdit.showFields')))
        fireEvent.click(screen.getByTestId('create-new-game'))
        await act(async () => { await Promise.resolve() })

        fireEvent.click(screen.getByText('cancel game'))
        expect(screen.queryByTestId('game-edit-form')).toBeNull()
        expect(screen.getByPlaceholderText(translate(cs, 'EventEdit.name'))).toBeTruthy()
    })
})
