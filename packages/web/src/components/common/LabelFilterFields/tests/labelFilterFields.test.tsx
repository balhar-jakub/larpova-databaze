/**
 * @jest-environment jsdom
 */
/**
 * The label filter fields: two labeled lists (required and optional),
 * each forwarding its selection change to the page callback.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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

// The list field is a controlled checkbox list; stub it as one.
jest.unstable_mockModule('../../form/FormLabelListField', () => ({
    default: ({ name, labels, onChange }: {
        name: string
        labels: Array<{ id: string; name: string }>
        onChange: (ids: string[]) => void
    }) => (
        <div data-testid={`label-list-${name}`}>
            {labels.map(label => (
                <label key={label.id}>
                    <input type="checkbox" onChange={() => onChange([label.id])} />
                    {label.name}
                </label>
            ))}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    LabelInList: {} as unknown,
}))

let LabelFilterFields: typeof import('../LabelFilterFields').default

beforeAll(async () => {
    LabelFilterFields = (await import('../LabelFilterFields')).default
})

beforeEach(() => cleanup())

const labels = [{ id: '1', name: 'svět' }]

describe('LabelFilterFields', () => {
    it('renders the required and optional sections with their lists', () => {
        render(<LabelFilterFields requiredLabelList={labels} optionalLabelList={labels} onSelectionChanged={() => undefined} />)

        expect(screen.getByText(translate(cs, 'LabelFilterFields.required'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'LabelFilterFields.optional'))).toBeTruthy()
        expect(screen.getAllByTestId('label-list-requiredLabels').length).toBe(1)
        expect(screen.getAllByTestId('label-list-optionalLabels').length).toBe(1)
    })

    it('forwards required and optional selections separately', () => {
        const changes: Array<{ newRequiredLabels?: string[]; newOptionalLabels?: string[] }> = []
        render(<LabelFilterFields requiredLabelList={labels} optionalLabelList={labels} onSelectionChanged={change => changes.push(change)} />)

        fireEvent.click(screen.getByTestId('label-list-requiredLabels').querySelector('input')!)
        fireEvent.click(screen.getByTestId('label-list-optionalLabels').querySelector('input')!)

        expect(changes).toEqual([
            { newRequiredLabels: ['1'] },
            { newOptionalLabels: ['1'] },
        ])
    })
})
