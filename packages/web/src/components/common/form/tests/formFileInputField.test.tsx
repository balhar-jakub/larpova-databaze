/**
 * @jest-environment jsdom
 */
/**
 * The file input field: reads a small file into base64 with its name,
 * rejects files over the size limit with the localized error, and clears
 * when the file is removed.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'
import { Form as FinalForm } from 'react-final-form'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

let FormFileInputField: typeof import('../FormFileInputField')['default']

beforeAll(async () => {
    FormFileInputField = (await import('../FormFileInputField')).default
})

beforeEach(() => cleanup())

let lastValues: Record<string, unknown> = {}

const renderField = (sizeLimit = 1_000_000) =>
    render(
        <FinalForm
            onSubmit={(values) => {
                lastValues = values as Record<string, unknown>
                return Promise.resolve()
            }}
        >
            {({ handleSubmit }) => (
                <form onSubmit={handleSubmit}>
                    <FormFileInputField name="image" sizeLimit={sizeLimit} />
                </form>
            )}
        </FinalForm>,
    )

const pick = (name: string, size: number, content = 'x') => {
    const file = new File([content], name, { type: 'text/plain' })
    Object.defineProperty(file, 'size', { value: size })
    // jsdom does not build a real FileList for fireEvent; give the input a
    // minimal one that answers .item(0) and [0].
    const fileList = {
        0: file,
        length: 1,
        item: (index: number) => (index === 0 ? file : null),
    }
    const input = document.querySelector('input')!
    Object.defineProperty(input, 'files', { value: fileList, configurable: true })
    fireEvent.change(input)
    return file
}

describe('FormFileInputField', () => {
    it('rejects a file over the size limit with the localized error', async () => {
        renderField()

        pick('obrazek.png', 2_000_000)

        await waitFor(() => expect(screen.getByText(translate(cs, 'FormFileInput.fileTooBig', { limit: '1 MB' }))).toBeTruthy())
    })

    it('stores the picked file encoded in the form values', async () => {
        renderField()

        pick('obrazek.txt', 1000, 'hello')

        // The FileReader decodes asynchronously; poll the form state via
        // repeated submits until the encoded value lands.
        await waitFor(() => {
            fireEvent.submit(document.querySelector('form')!)
            const value = String(lastValues.image ?? '')
            expect(value).toContain('obrazek.txt')
            expect(value.split('\t')[1]).toBe(btoa('hello'))
        }, { timeout: 3000 })
    })

    it('clears the value when the file is removed', async () => {
        renderField()

        pick('obrazek.txt', 1000, 'hello')
        await waitFor(() => {
            fireEvent.submit(document.querySelector('form')!)
            expect(String(lastValues.image ?? '')).toContain('obrazek.txt')
        }, { timeout: 3000 })

        const input = document.querySelector('input[type="file"]')!
        Object.defineProperty(input, 'files', { value: { length: 0, item: () => null }, configurable: true })
        fireEvent.change(input)
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => {
            fireEvent.submit(document.querySelector('form')!)
            expect([undefined, '']).toContain(lastValues.image)
        }, { timeout: 3000 })
    })
})
