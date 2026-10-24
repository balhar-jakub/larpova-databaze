/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'
import { Gender } from 'src/graphql/__generated__/typescript-operations'

/**
 * The profile header talks about the owner of the profile — "Hráč 3 larpů" is
 * somebody else's count when a visitor opens the page, so the gender comes from
 * the profile, not from the visitor. Women read "Hráčka … , tvůrkyně …".
 *
 * The Czech values use a non-breaking space between the count and the noun, so
 * the expectations spell it out (`\u00a0`) instead of a plain space.
 */

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

let UserDetailPanel: typeof import('../UserDetailPanel').default

beforeAll(async () => {
    UserDetailPanel = (await import('../UserDetailPanel')).default
})

const userData = (gender?: Gender) => ({
    id: '42',
    name: 'Testovací Uživatelka',
    nickname: null,
    email: 'user@example.invalid',
    amountOfPlayed: 3,
    amountOfCreated: 2,
    birthDate: null,
    gender,
})

const textOf = (gender?: Gender) => render(<UserDetailPanel userData={userData(gender)} />).container.textContent ?? ''

describe('the profile header speaks in the gender of the profile owner', () => {
    test('a woman is a Hráčka and a tvůrkyně', () => {
        const text = textOf(Gender.Female)

        expect(text).toContain('Hráčka 3\u00a0larpů')
        expect(text).toContain('tvůrkyně 2\u00a0larpů')
    })

    test('a man is a Hráč and a tvůrce', () => {
        const text = textOf(Gender.Male)

        expect(text).toContain('Hráč 3\u00a0larpů')
        expect(text).toContain('tvůrce 2\u00a0larpů')
    })

    test('an unstated gender reads both forms', () => {
        const text = textOf(Gender.Unspecified)

        expect(text).toContain('Hráč/čka 3\u00a0larpů')
        expect(text).toContain('tvůrce 2\u00a0larpů')
    })
})

describe('branch arms of the profile header', () => {
    test('an avatar image is served when the user has one, the default otherwise', () => {
        const withImage = render(
            <UserDetailPanel userData={{ ...userData(), image: { id: 'img7' } } as never} />,
        )
        expect(withImage.container.querySelector('img')?.getAttribute('src')).toBe('/user-icon?id=42&imageId=img7')

        cleanup()
        const without = render(<UserDetailPanel userData={userData() as never} />)
        expect(without.container.querySelector('img')?.getAttribute('src')).toBe('/images/user-icon.png')
    })

    test('a missing profile renders the empty placeholder', () => {
        const { container } = render(<UserDetailPanel userData={undefined as never} />)
        expect(container.querySelector('img')).toBeNull()
        expect(container.querySelector('div')).toBeTruthy()
    })

    test('the age shows only when the birth date gives one', () => {
        const withAge = render(
            <UserDetailPanel userData={{ ...userData(), birthDate: '2000-05-01' } as never} />,
        )
        expect(withAge.container.textContent).toMatch(/\d+\u00a0let/)

        cleanup()
        const withoutAge = render(<UserDetailPanel userData={userData() as never} />)
        expect(withoutAge.container.textContent).not.toMatch(/\d+\u00a0let/)
    })

    test('played and created counts fall back to zero', () => {
        const sparse = render(
            <UserDetailPanel userData={{ ...userData(), amountOfPlayed: null, amountOfCreated: null } as never} />,
        )
        // The gender context with no gender reads as the generic form.
        expect(sparse.container.textContent).toContain('Hráč/čka 0')
    })
})
