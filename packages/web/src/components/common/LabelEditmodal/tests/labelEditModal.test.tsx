/**
 * @jest-environment jsdom
 */
/**
 * The label edit modal: creates labels with name + description, requires
 * the name, and rejects names that already exist.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const createdLabels: Array<{ name?: string; description?: string }> = []
const hidden: boolean[] = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({ useFocusInput: () => ({ current: null }) }))
jest.unstable_mockModule('../../form/FormTextInputField', () => ({
    default: ({ name, placeholder }: { name: string; placeholder?: string }) => {
        const { useField } = jest.requireActual('react-final-form') as typeof import('react-final-form')
        const { input, meta } = useField(name)
        return (
            <div>
                <input name={name} placeholder={placeholder} data-testid={`field-${name}`} onChange={input.onChange} value={input.value ?? ''} />
                {meta.error && meta.touched && <div data-testid={`error-${name}`}>{meta.error}</div>}
            </div>
        )
    },
}))
jest.unstable_mockModule('../../SubmitButton/SubmitButton', () => ({
    default: ({ children, submitting }: { children: React.ReactNode; submitting?: boolean }) => (
        <button type="submit" disabled={submitting}>{children}</button>
    ),
}))

let LabelEditModal: typeof import('../LabelEditModal')['default']

beforeAll(async () => {
    LabelEditModal = (await import('../LabelEditModal')).default
})

beforeEach(() => {
    cleanup()
    createdLabels.length = 0
    hidden.length = 0
})

const renderModal = (over: Record<string, unknown> = {}) =>
    render(
        <LabelEditModal
            titleKey="LabelEditModal.titleEdit"
            existingNewLabels={[{ name: 'Nová existující' }]}
            existingLabelNames={['Existující']}
            onHide={() => { hidden.push(true) }}
            onCreateLabel={(label) => { createdLabels.push(label) }}
            {...over}
        />,
    )

describe('LabelEditModal', () => {
    it('creates a label with name and description', async () => {
        renderModal()

        fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Dungeon' } })
        fireEvent.change(screen.getByTestId('field-description'), { target: { value: 'Hra v tajemném podzemí' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(createdLabels).toEqual([{ name: 'Dungeon', description: 'Hra v tajemném podzemí' }]))
    })

    it('requires the name', () => {
        renderModal()

        fireEvent.submit(document.querySelector('form')!)

        expect(createdLabels.length).toBe(0)
        expect(screen.getByTestId('error-name').textContent).toBe(translate(cs, 'Errors.required'))
    })

    it('rejects a name that already exists', () => {
        renderModal()

        fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Existující' } })
        fireEvent.submit(document.querySelector('form')!)

        expect(createdLabels.length).toBe(0)
        expect(screen.getByTestId('error-name').textContent).toBe(translate(cs, 'LabelEditModal.labelExists'))
    })

    it('rejects a name that exists among the new labels', () => {
        renderModal()

        fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Nová existující' } })
        fireEvent.submit(document.querySelector('form')!)

        expect(createdLabels.length).toBe(0)
    })

    it('prefills the initial values when editing', async () => {
        // The panel passes existingLabelNames minus the edited label itself.
        renderModal({
            initialValues: { name: 'Staré jméno', description: 'Starý popis' },
            existingLabelNames: [],
        })

        expect((screen.getByTestId('field-name') as HTMLInputElement).value).toBe('Staré jméno')
        expect((screen.getByTestId('field-description') as HTMLInputElement).value).toBe('Starý popis')

        fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Nové jméno' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(createdLabels).toEqual([{ name: 'Nové jméno', description: 'Starý popis' }]))
    })
})
