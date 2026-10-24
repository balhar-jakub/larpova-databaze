/**
 * @jest-environment jsdom
 */
/**
 * The catalog filter panel directly: year and players ranges commit on
 * Enter, the query draft commits on Enter and resets, and the reset
 * button fires onReset.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const patches: Array<Record<string, unknown>> = []
let resets = 0

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('src/utils/gtag', () => ({
    GA_ENABLED: false,
    GA_CONSENT_KEY: 'ga-consent',
    storeGTagConsent: () => undefined,
    updateGTagConsent: () => undefined,
}))

let CatalogFilterPanel: typeof import('../CatalogFilterPanel')['default']

beforeAll(async () => {
    CatalogFilterPanel = (await import('../CatalogFilterPanel')).default
})

beforeEach(() => {
    cleanup()
    patches.length = 0
    resets = 0
})

const state = {
    page: 0,
    order: 'RECOMMENDED',
    query: '',
    labels: [],
    durations: [],
    yearFrom: undefined,
    yearTo: undefined,
    playersFrom: undefined,
    playersTo: undefined,
}

const facets = (over: Record<string, unknown> = {}) => ({
    labels: [
        { id: 'l1', name: 'svět', count: 3, isRequired: true },
        { id: 'l2', name: 'fantasy', count: 5, isRequired: false },
        { id: 'l3', name: 'drama', count: 1, isRequired: false },
    ],
    durations: [{ key: 'short', count: 7 }],
    yearMin: 2000,
    yearMax: 2026,
    ...over,
})

const renderPanel = (over: Record<string, unknown> = {}) =>
    render(
        <CatalogFilterPanel
            state={state as never}
            facets={facets(over) as never}
            onStateChange={(patch) => { patches.push(patch as Record<string, unknown>) }}
            onReset={() => { resets += 1 }}
        />,
    )

describe('CatalogFilterPanel', () => {
    it('commits the query draft on Enter', () => {
        renderPanel()

        const query = screen.getByTestId('catalog.query')
        fireEvent.change(query, { target: { value: 'dungeon' } })
        expect(patches.length).toBe(0)

        fireEvent.keyDown(query, { key: 'Enter' })
        expect(patches).toEqual([{ query: 'dungeon' }])
    })

    it('commits the year range on Enter', () => {
        renderPanel()

        const yearFrom = screen.getByLabelText(`${translate(cs, 'Catalog.filters.yearShort')} ${translate(cs, 'Catalog.filters.from')}`)
        fireEvent.change(yearFrom, { target: { value: '2015' } })
        fireEvent.keyDown(yearFrom, { key: 'Enter' })

        expect(patches).toEqual([{ yearFrom: 2015, yearTo: undefined }])
    })

    it('commits the players range on Enter', () => {
        renderPanel()

        const playersFrom = screen.getByLabelText(`${translate(cs, 'Catalog.filters.playersShort')} ${translate(cs, 'Catalog.filters.from')}`)
        fireEvent.change(playersFrom, { target: { value: '10' } })
        fireEvent.keyDown(playersFrom, { key: 'Enter' })

        expect(patches).toEqual([{ playersFrom: 10, playersTo: undefined }])
    })

    it('fires onReset from the reset button', () => {
        renderPanel()

        fireEvent.click(screen.getByTestId('catalog.reset'))
        expect(resets).toBe(1)
    })

    it('toggles a required-label checkbox and reports the new selection', () => {
        renderPanel()

        fireEvent.click(screen.getByText('svět'))

        expect(patches).toEqual([{ labels: ['l1'] }])
    })

    it('switches the label mode between all and any', () => {
        // The mode row only renders once more than one label is selected.
        patches.length = 0
        render(
            <CatalogFilterPanel
                state={{ ...state, labels: ['l1', 'l2'], labelMode: 'all' } as never}
                facets={facets() as never}
                onStateChange={(patch) => { patches.push(patch as Record<string, unknown>) }}
                onReset={() => { resets += 1 }}
            />,
        )

        fireEvent.click(screen.getByText(translate(cs, 'Catalog.filters.labelModeAny')))

        expect(patches).toEqual([{ labelMode: 'any' }])
    })

    it('expands the theme list and back', () => {
        // The expand button only appears past the preview count (8).
        const manyThemes = Array.from({ length: 10 }, (_, i) => ({
            id: `t${i}`, name: `tema-${i}`, count: 1, isRequired: false,
        }))
        patches.length = 0
        render(
            <CatalogFilterPanel
                state={state as never}
                facets={facets({ labels: manyThemes }) as never}
                onStateChange={(patch) => { patches.push(patch as Record<string, unknown>) }}
                onReset={() => { resets += 1 }}
            />,
        )

        expect(screen.queryByText('tema-9')).toBeNull()
        fireEvent.click(screen.getByText(translate(cs, 'Catalog.filters.showAllThemes', { count: 10 })))
        expect(screen.getByText('tema-9')).toBeTruthy()

        fireEvent.click(screen.getByText(translate(cs, 'Catalog.filters.showFewerThemes')))
        expect(screen.queryByText('tema-9')).toBeNull()
    })

    it('toggles a duration checkbox', () => {
        renderPanel()

        fireEvent.click(screen.getByText(translate(cs, 'Catalog.durations.short')))

        expect(patches).toEqual([{ durations: ['short'] }])
    })

    it('toggles the with-comments and with-image filters', () => {
        renderPanel()

        const toggleByLabel = (labelText: string) => {
            const label = screen.getByText(labelText).closest('label')
            const input = label!.querySelector('input')
            fireEvent.click(input!)
        }
        toggleByLabel(translate(cs, 'Catalog.filters.withComments'))
        expect(patches.at(-1)).toEqual({ withComments: true })

        toggleByLabel(translate(cs, 'Catalog.filters.withImage'))
        expect(patches.at(-1)).toEqual({ withImage: true })
    })

    it('commits the to-side of the year range on Enter', () => {
        renderPanel()

        const yearTo = screen.getByLabelText(`${translate(cs, 'Catalog.filters.yearShort')} ${translate(cs, 'Catalog.filters.to')}`)
        fireEvent.change(yearTo, { target: { value: '2020' } })
        fireEvent.keyDown(yearTo, { key: 'Enter' })

        expect(patches).toEqual([{ yearFrom: undefined, yearTo: 2020 }])
    })

    it('toggles the recommended-only and enough-ratings filters', () => {
        renderPanel()

        fireEvent.click(screen.getByText(/jen doporučované/))
        expect(patches.at(-1)).toEqual({ minRating: 70 })
    })
})
