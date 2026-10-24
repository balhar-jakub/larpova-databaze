/**
 * @jest-environment jsdom
 */
/**
 * The search suggestion: renders nothing without a suggestion, and with
 * one offers the did-you-mean link that fires onUse with the word.
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

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

let SearchSuggestion: typeof import('../SearchSuggestion').SearchSuggestion

beforeAll(async () => {
    SearchSuggestion = (await import('../SearchSuggestion')).SearchSuggestion
})

beforeEach(() => cleanup())

describe('SearchSuggestion', () => {
    it('renders nothing without a suggestion', () => {
        const { container } = render(<SearchSuggestion suggestion={undefined} onUse={() => undefined} />)

        expect(container.innerHTML).toBe('')
    })

    it('offers the suggestion and reports its use', () => {
        const onUse = jest.fn()
        render(<SearchSuggestion suggestion="draci" onUse={onUse} />)

        expect(screen.getByText(translate(cs, 'Search.didYouMean'))).toBeTruthy()
        fireEvent.click(screen.getByText('draci'))

        expect(onUse).toHaveBeenCalledWith('draci')
    })
})
