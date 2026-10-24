/**
 * @jest-environment jsdom
 */
/**
 * `ArticleListPanel` — the "Články o hře" block on the game detail page.
 * Renders one external link per article: title, (date), source site.
 * The wording is asserted against the shipped Czech locale through the
 * real resolver, not a fixture.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
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

describe('ArticleListPanel', () => {
    let ArticleListPanel: typeof import('../ArticleListPanel')['ArticleListPanel']

    const articles = [
        {
            __typename: 'Article' as const,
            id: '1',
            url: 'https://www.larpy.cz/reportaz/',
            title: 'Reportáž z běhu',
            source: 'LARPY_CZ' as const,
            publishedAt: '2026-03-25T10:00:00.000Z',
        },
        {
            __typename: 'Article' as const,
            id: '2',
            url: 'https://www.larp.cz/?q=cs/clanek/9739/recenze',
            title: 'Recenze hry',
            source: 'LARP_CZ' as const,
            publishedAt: null,
        },
    ]

    beforeAll(async () => {
        ;({ ArticleListPanel } = await import('../ArticleListPanel'))
    })

    it('renders the title and one link per article with source and date', () => {
        render(<ArticleListPanel articles={articles as never} titleKey="GameDetail.articles" />)
        expect(screen.getByText('Články o hře')).toBeTruthy()
        const first = screen.getByText(/Reportáž z běhu/).closest('a')
        expect(first).not.toBeNull()
        expect(first!.getAttribute('href')).toBe('https://www.larpy.cz/reportaz/')
        expect(first!.getAttribute('target')).toBe('_blank')
        // date renders as d. m. yyyy and the source site name is shown
        expect(first!.textContent).toContain('25. 03. 2026')
        expect(first!.textContent).toContain('larpy.cz')
        const second = screen.getByText(/Recenze hry/).closest('a')
        expect(second!.getAttribute('href')).toBe('https://www.larp.cz/?q=cs/clanek/9739/recenze')
        expect(second!.textContent).toContain('larp.cz')
        // no date on the second article — no empty parens
        expect(second!.textContent).not.toContain('()')
        cleanup()
    })

    it('renders an empty list without links when no articles exist', () => {
        render(<ArticleListPanel articles={[]} titleKey="GameDetail.articles" />)
        expect(screen.getByText('Články o hře')).toBeTruthy()
        expect(screen.queryByRole('link')).toBeNull()
        cleanup()
    })

    it('renders no date prefix for an article missing its date parts', () => {
        render(<ArticleListPanel articles={[{ __typename: 'Article', id: 'a2', url: 'https://example.test', publishedAt: null, source: null, authors: null, perex: null, title: 'Bez data' } as never] as never} />)
        // The missing date arm: the row renders without a date segment.
        expect(screen.getByText('Bez data')).toBeTruthy()
        expect(document.body.textContent).not.toContain('NaN')
    })
})
