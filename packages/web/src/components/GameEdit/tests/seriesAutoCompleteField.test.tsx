/**
 * @jest-environment jsdom
 */
/**
 * `SeriesAutoCompleteField` — the "Série" field of the game edit form.
 *
 * The component is a plain picker over `seriesByQuery` plus a "create new by
 * name" row; what it must never do is fail to render (an unimported style
 * helper or a hook taken from the wrong place is a runtime crash the build does
 * not catch, because this repo's tsc is not a gate). The cases below therefore
 * render it inside a real react-final-form and assert both the rendered state
 * and what the field reports to the form.
 */
import React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
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

/** The query result the mocked lazy query hands back; set per test. */
let searchResult: Array<{ id: string; name: string; amountOfGames: number }> = []
const searchCalls: Array<Record<string, unknown>> = []
let loading = false

jest.unstable_mockModule('@apollo/client', () => ({
    useLazyQuery: () => [
        (options: { variables: Record<string, unknown> }) => {
            searchCalls.push(options.variables)
            return Promise.resolve({})
        },
        { loading, data: { seriesByQuery: searchResult } },
    ],
}))

describe('SeriesAutoCompleteField', () => {
    let SeriesAutoCompleteField: typeof import('../SeriesAutoCompleteField')['default']
    let Form: typeof import('react-final-form')['Form']

    beforeAll(async () => {
        SeriesAutoCompleteField = (await import('../SeriesAutoCompleteField')).default
        Form = (await import('react-final-form')).Form
    })

    afterEach(() => {
        cleanup()
        searchResult = []
        searchCalls.length = 0
        loading = false
    })

    /** Renders the field in a form and reports every value the form received. */
    const renderField = (initial?: unknown) => {
        const seen: any[] = []
        render(
            <Form
                onSubmit={() => undefined}
                initialValues={{ series: initial }}
                render={({ values }) => {
                    seen.push(values.series)
                    return <SeriesAutoCompleteField name="series" placeholder="Série" hint="Nápověda" />
                }}
            />,
        )
        return seen
    }

    it('renders the picker with its placeholder', () => {
        renderField()
        expect(screen.getByPlaceholderText('Série')).toBeTruthy()
        expect(screen.getByText('Nápověda')).toBeTruthy()
    })

    it('searches as the editor types and reports the picked series to the form', async () => {
        searchResult = [{ id: '12', name: 'Florie', amountOfGames: 9 }]
        const seen = renderField()

        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText('Série'), { target: { value: 'Flo' } })
        })

        expect(searchCalls.at(-1)).toEqual({ query: 'Flo' })
        const option = await screen.findByText('Florie (9)')

        await act(async () => {
            fireEvent.mouseDown(option)
        })

        // The chosen series becomes a chip and the form holds the choice.
        expect(screen.queryByPlaceholderText('Série')).toBeNull()
        expect(screen.getByText('Florie (9)')).toBeTruthy()
        expect(seen.at(-1)).toMatchObject({ id: '12', name: 'Florie', amountOfGames: 9 })
    })

    it('offers "create new" for a typed name and holds it as a series to be created', async () => {
        const seen = renderField()

        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText('Série'), { target: { value: 'Nová série' } })
        })

        const createRow = await screen.findByText(/Vytvořit novou sérii/)
        await act(async () => {
            fireEvent.mouseDown(createRow)
        })

        // No id: the API creates the series from the name on save.
        expect(seen.at(-1)).toMatchObject({ name: 'Nová série', isNew: true })
        expect(seen.at(-1).id).toBeUndefined()
    })

    it('shows an existing series as a chip and clears it on remove', async () => {
        const seen = renderField({ id: '5', name: 'Zlenice', amountOfGames: 18, itemLabel: 'Zlenice (18)' })

        expect(screen.getByText('Zlenice (18)')).toBeTruthy()
        expect(screen.queryByPlaceholderText('Série')).toBeNull()

        await act(async () => {
            fireEvent.click(screen.getByLabelText('remove'))
        })

        expect(screen.getByPlaceholderText('Série')).toBeTruthy()
        expect(seen.at(-1)).toBeNull()
    })
})
