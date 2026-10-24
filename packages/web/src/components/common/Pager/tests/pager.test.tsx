/**
 * @jest-environment jsdom
 */
/**
 * The pager: first/prev/next/last buttons plus the numbered pages, and
 * the optional range label "1.–25. z 121".
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

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const offsets: number[] = []
let mdOrLarger = true

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('../../../../hooks/useMediaQuery', () => ({
    useIsMdOrLarger: () => mdOrLarger,
}))

let Pager: typeof import('../Pager').default

beforeAll(async () => {
    Pager = (await import('../Pager')).default
})

beforeEach(() => {
    cleanup()
    offsets.length = 0
    mdOrLarger = true
})

const renderPager = (over: Record<string, unknown> = {}) =>
    render(
        <Pager
            currentOffset={0}
            totalAmount={100}
            pageSize={25}
            onOffsetChanged={(offset) => { offsets.push(offset) }}
            {...over}
        />,
    )

describe('Pager', () => {
    it('shows the range label with the current window', () => {
        renderPager({ currentOffset: 25, rangeLabel: true })

        expect(screen.getByTestId('search.range').textContent).toBe(
            translate(cs, 'Search.rangeLabel', { from: 26, to: 50, total: 100 }),
        )
    })

    it('jumps to the ends and steps one page', () => {
        renderPager()

        // <<, <, 1, 2, 3, 4, >, >> — eight buttons for four pages.
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBe(8)
        fireEvent.click(buttons[1]) // prev on the first page -> stays at 0
        expect(offsets.at(-1)).toBe(0)
        fireEvent.click(buttons[6]) // next
        expect(offsets.at(-1)).toBe(25)
        fireEvent.click(buttons[7]) // last
        expect(offsets.at(-1)).toBe(75)
        fireEvent.click(buttons[0]) // first
        expect(offsets.at(-1)).toBe(0)
    })

    it('clamps the last page when the total is not a multiple', () => {
        renderPager({ totalAmount: 110 })

        const buttons = screen.getAllByRole('button')
        fireEvent.click(buttons[buttons.length - 1]) // last
        expect(offsets.at(-1)).toBe(100)
    })
})
