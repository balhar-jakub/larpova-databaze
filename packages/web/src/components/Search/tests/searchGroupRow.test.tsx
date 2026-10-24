/**
 * @jest-environment jsdom
 */
/**
 * The group row of the unified search: the name with the query
 * highlighted, the author count, and the link to the group detail page.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        groupDetail: (id: string) => ({ href: `/groupDetail?id=${id}`, as: `/group/${id}` }),
    }),
}))

let SearchGroupRow: typeof import('../SearchGroupRow').SearchGroupRow

beforeAll(async () => {
    SearchGroupRow = (await import('../SearchGroupRow')).SearchGroupRow
})

beforeEach(() => cleanup())

const group = {
    __typename: 'Group',
    id: 'g1',
    name: 'Dragon Games',
    authorsOf: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
}

describe('SearchGroupRow', () => {
    it('shows the group name with the author count', () => {
        render(<SearchGroupRow group={group as never} query="dragon" />)

        expect(screen.getAllByText((_, el) => el?.textContent === 'Dragon Games').length).toBeGreaterThan(0)
        expect(screen.getByText(translate(cs, 'Search.groupGames', { count: 3 }))).toBeTruthy()
    })

    it('handles a group without authors', () => {
        render(<SearchGroupRow group={{ ...group, authorsOf: null } as never} query="dragon" />)

        expect(screen.getByText(translate(cs, 'Search.groupGames', { count: 0 }))).toBeTruthy()
    })

    it('links to the group detail page', () => {
        render(<SearchGroupRow group={group as never} query="dragon" />)

        const link = screen.getByText(translate(cs, 'Search.groupGamesLink')).closest('a')
        expect(link?.getAttribute('href')).toBe('/group/g1')
    })
})
