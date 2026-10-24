/**
 * @jest-environment jsdom
 */
/**
 * The person row of the unified search: name links to the profile with the
 * query highlighted, the meta line joins city and age, the games-of-author
 * link on the side, and the match reason for nickname/city matches.
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
        gamesOfAuthor: (id: string, name: string) => ({
            href: `/games?autor=${id}&autorn=${encodeURIComponent(name)}`,
            as: `/games?autor=${id}&autorn=${encodeURIComponent(name)}`,
        }),
    }),
}))
jest.unstable_mockModule('../../common/ProfileImage/ProfileImage', () => ({
    ProfileImage: () => <div data-testid="profile-image" />,
}))
jest.unstable_mockModule('../../common/UserLink/UserLink', () => ({
    default: ({ userId, children }: { userId: string; children: React.ReactNode }) => (
        <a href={`/profile?id=${userId}`}>{children}</a>
    ),
}))
jest.unstable_mockModule('../../common/TextLink/TextLink', () => ({
    TextLink: ({ href, children }: { href: string; children: React.ReactNode }) => (
        <a href={href}>{children}</a>
    ),
}))

let SearchPersonRow: typeof import('../SearchPersonRow').SearchPersonRow

beforeAll(async () => {
    SearchPersonRow = (await import('../SearchPersonRow')).SearchPersonRow
})

beforeEach(() => cleanup())

const person = (over: Record<string, unknown> = {}) => ({
    __typename: 'User',
    id: 'u1',
    name: 'Jakub Balhar',
    nickname: null,
    city: 'Praha',
    birthDate: null,
    image: null,
    ...over,
})

describe('SearchPersonRow', () => {
    it('links the name to the profile and shows the city', () => {
        render(<SearchPersonRow person={person() as never} query="jakub" />)

        const profileLink = screen
            .getAllByText((_, el) => el?.textContent === 'Jakub Balhar')
            .find(el => el.tagName === 'A')
        expect(profileLink?.getAttribute('href')).toBe('/profile?id=u1')
        expect(screen.getByText('Praha')).toBeTruthy()
    })

    it('joins the city and the computed age in the meta line', () => {
        render(<SearchPersonRow person={person({ birthDate: '1990-05-01' }) as never} query="jakub" />)

        expect(screen.getByText(/Praha · \d+ let/)).toBeTruthy()
    })

    it('says when the person has no city at all', () => {
        render(<SearchPersonRow person={person({ city: null }) as never} query="jakub" />)

        expect(screen.getByText(translate(cs, 'Search.personNoCity'))).toBeTruthy()
    })

    it('links to the games of the author on the side', () => {
        render(<SearchPersonRow person={person() as never} query="jakub" />)

        const gamesLink = screen.getByText(translate(cs, 'Search.userGames', { name: 'Jakub Balhar' })).closest('a')
        expect(gamesLink?.getAttribute('href')).toContain('autor=u1')
        expect(gamesLink?.getAttribute('href')).toContain('autorn=Jakub%20Balhar')
    })

    it('names the matched nickname with the match reason', () => {
        render(<SearchPersonRow person={person({ nickname: 'jakubcz' }) as never} query="jakubcz" />)

        expect(screen.getByText(translate(cs, 'Search.matchNickname', { name: 'jakubcz' }))).toBeTruthy()
        expect(screen.getByText('jakubcz')).toBeTruthy()
    })
})
