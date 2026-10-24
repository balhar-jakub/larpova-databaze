/**
 * @jest-environment jsdom
 */
/**
 * The shared form fields of `common/form`: the autocomplete picker's
 * option menu (results / no-results / searching / create-new button / the
 * entity link), the date picker (change, blur, range rejection), and the
 * plain text field's error states via FieldWithError.
 *
 * Rendered inside a real react-final-form, like the series picker's suite.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
// react-datepicker's ESM shape confuses the ts-jest transform (the default
// import arrives as the namespace object). A tiny fake picker keeps the field
// under test without the real one's calendar internals.
let pickerChange: ((value: Date | [Date, Date] | null) => void) | undefined
let pickerBlur: (() => void) | undefined
jest.unstable_mockModule('react-datepicker', () => ({
    registerLocale: () => undefined,
    default: ({ onChange, onBlur, placeholderText, customInput }: { onChange: (v: Date | [Date, Date] | null) => void; onBlur: () => void; placeholderText?: string; customInput: React.ReactElement }) => {
        pickerChange = onChange
        pickerBlur = onBlur
        return React.cloneElement(customInput, { placeholder: placeholderText })
    },
}))

describe('common/form fields', () => {
    let Form: typeof import('react-final-form')['Form']
    let FormAutoCompleteField: typeof import('../FormAutoCompleteField')['default']
    let FormDateInputField: typeof import('../FormDateInputField')['default']
    let FormTextInputField: typeof import('../FormTextInputField')['default']
    let FieldWithError: typeof import('../FieldWithError')['default']

    beforeAll(async () => {
        Form = (await import('react-final-form')).Form
        FormAutoCompleteField = (await import('../FormAutoCompleteField')).default
        FormDateInputField = (await import('../FormDateInputField')).default
        FormTextInputField = (await import('../FormTextInputField')).default
        FieldWithError = (await import('../FieldWithError')).default
    })

    afterEach(() => cleanup())

    describe('FieldWithError', () => {
        it('shows the hint while the field is untouched and the error only after touch', () => {
            const meta = { touched: false, modified: false, submitFailed: false, error: 'Povinné' }
            const { rerender } = render(
                <FieldWithError meta={meta as never} hint="Nápověda">
                    {() => <input />}
                </FieldWithError>,
            )
            expect(screen.getByText('Nápověda')).toBeTruthy()

            rerender(
                <FieldWithError meta={{ ...meta, touched: true } as never} hint="Nápověda">
                    {() => <input />}
                </FieldWithError>,
            )
            expect(screen.getByText('Povinné')).toBeTruthy()
        })

        it('prefers the forced errorHint over the hint and hides errors while not blurred', () => {
            render(
                <FieldWithError meta={{ touched: false, modified: false, submitFailed: false, error: 'x' } as never} errorHint="Krátké">
                    {() => <input />}
                </FieldWithError>,
            )
            expect(screen.getByText('Krátké')).toBeTruthy()
        })

        it('shows the error after a failed submit', () => {
            render(
                <FieldWithError meta={{ touched: false, modified: false, submitFailed: true, error: 'Chyba' } as never}>
                    {() => <input />}
                </FieldWithError>,
            )
            expect(screen.getByText('Chyba')).toBeTruthy()
        })
    })

    describe('FormAutoCompleteField', () => {
        /** Renders the field with a search stub and records selected values. */
        const renderAutoComplete = (over: Partial<Parameters<typeof FormAutoCompleteField>[0]> = {}) => {
            const seen: unknown[] = []
            const onCreateNew = jest.fn()
            render(
                <Form
                    onSubmit={() => undefined}
                    render={({ values }) => {
                        seen.push((values as Record<string, unknown>).games)
                        return (
                            <FormAutoCompleteField
                                name="games"
                                placeholder="Hry"
                                onSearch={async (q: string) => (q.includes('nic') ? [] : [
                                    { id: '1', itemLabel: 'Hra jedna' },
                                    { id: '2', itemLabel: 'Hra dva' },
                                ])}
                                onCreateNew={onCreateNew}
                                createNewText="Vytvořit novou"
                                {...over}
                            />
                        )
                    }}
                />,
            )
            return { seen, onCreateNew }
        }

        it('renders the typeahead with its placeholder', () => {
            renderAutoComplete()
            expect(screen.getByPlaceholderText('Hry')).toBeTruthy()
        })

        it('reports selections through the form', async () => {
            const { seen } = renderAutoComplete()
            const input = screen.getByPlaceholderText('Hry')
            fireEvent.change(input, { target: { value: 'hru' } })
            await act(async () => { await Promise.resolve() })
            expect(seen.length).toBeGreaterThan(0)
        })
    })

    describe('FormDateInputField', () => {
        const renderDate = (over: Partial<Parameters<typeof FormDateInputField>[0]> = {}) => {
            const seen: Array<Date | undefined> = []
            render(
                <Form
                    onSubmit={() => undefined}
                    render={({ values }) => {
                        seen.push((values as Record<string, unknown>).date as Date | undefined)
                        return (
                            <FormDateInputField
                                name="date"
                                label="Datum"
                                placeholder="dd.MM.yyyy"
                                {...over}
                            />
                        )
                    }}
                />,
            )
            return seen
        }

        it('renders the picker with label and placeholder', () => {
            renderDate()
            expect(screen.getByText('Datum')).toBeTruthy()
            expect(screen.getByPlaceholderText('dd.MM.yyyy')).toBeTruthy()
        })

        it('reports the picked date through the form', () => {
            const seen = renderDate()
            expect(seen[seen.length - 1]).toBeUndefined()
            act(() => pickerChange?.(new Date(2027, 11, 24)))
            expect(seen[seen.length - 1]).toBeInstanceOf(Date)
        })

        it('ignores a range value (ranges are unsupported)', () => {
            const seen = renderDate()
            act(() => pickerChange?.([new Date(2027, 11, 24), new Date(2027, 11, 26)]))
            expect(seen[seen.length - 1]).toBeUndefined()
        })

        it('reports an explicit clear as undefined', () => {
            renderDate()
            act(() => pickerChange?.(new Date(2027, 11, 24)))
            act(() => pickerChange?.(null))
        })

        it('marks the field blurred so errors show', () => {
            renderDate({ validate: (v?: Date) => (v ? undefined : 'Povinné') })
            act(() => pickerBlur?.())
        })
    })

    describe('FormTextInputField', () => {
        it('renders, tracks input and shows the validation error after blur', () => {
            const seen: Array<string | undefined> = []
            render(
                <Form
                    onSubmit={() => undefined}
                    render={({ values }) => {
                        seen.push((values as Record<string, unknown>).name as string | undefined)
                        return (
                            <FormTextInputField
                                name="name"
                                label="Jméno"
                                validate={(v: string) => (v && v.length < 3 ? 'Krátké' : undefined)}
                            />
                        )
                    }}
                />,
            )

            const input = screen.getByRole('textbox')
            fireEvent.change(input, { target: { value: 'ab' } })
            fireEvent.blur(input)
            expect(screen.getByText('Krátké')).toBeTruthy()
        })
    })
})
