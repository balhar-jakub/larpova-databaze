/**
 * @jest-environment jsdom
 */
/**
 * The homepage hero: the title, the stats sentence with Czech plurals,
 * the search box that routes to /search with the typed query, and the
 * popular-labels row.
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

const pushed: string[] = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ push: (url: string) => { pushed.push(url) } }),
}))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let HomeHeroPanel: typeof import('../HomeHeroPanel').HomeHeroPanel

beforeAll(async () => {
    HomeHeroPanel = (await import('../HomeHeroPanel')).HomeHeroPanel
})

beforeEach(() => {
    cleanup()
    pushed.length = 0
})

describe('HomeHeroPanel', () => {
    it('renders the title and the stats sentence', () => {
        render(<HomeHeroPanel stats={{ games: 1500, events: 300, upcomingEvents: 5, users: 900, labels: 40 }} />)

        expect(screen.getByText(translate(cs, 'HomePage.pageTitle'))).toBeTruthy()
        // The stats sentence carries the resolved Czech plural phrases.
        const stats = screen.getByText(/1500|1 500/, { selector: 'p' })
        expect(stats).toBeTruthy()
    })

    it('omits the stats line when there are no stats', () => {
        render(<HomeHeroPanel />)

        expect(screen.queryByText(translate(cs, 'HomePage.heroStats', {
            games: '', events: '', people: '', upcoming: '',
        }))).toBeNull()
    })

    it('routes the typed query to the search page', () => {
        render(<HomeHeroPanel />)

        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'dračí doupě' } })
        fireEvent.click(screen.getByText(translate(cs, 'HomePage.searchButton')))

        expect(pushed).toEqual([`/search?q=${encodeURIComponent('dračí doupě')}`])
    })

    it('goes to the bare search page for an empty query', () => {
        render(<HomeHeroPanel />)

        fireEvent.click(screen.getByText(translate(cs, 'HomePage.searchButton')))

        expect(pushed).toEqual(['/search'])
    })

    it('lists the popular labels', () => {
        render(
            <HomeHeroPanel
                labels={[
                    { id: 'l1', name: 'svět', count: 12, isRequired: true },
                    { id: 'l2', name: 'fantasy', count: 8, isRequired: false },
                ]}
            />,
        )

        expect(screen.getByText('svět')).toBeTruthy()
        expect(screen.getByText('fantasy')).toBeTruthy()
    })
})
