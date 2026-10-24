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

const renderPanel = () =>
    render(
        <CatalogFilterPanel
            state={state as never}
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
})
