/**
 * Guards the public profile header: it shows the nickname, the name and the bio
 * — and never the account email.
 *
 * `/profile/<id>` renders for visitors who are not signed in (the page passes
 * `requiredRole="ANONYMOUS"`, which skips the sign-in guard), so a stray
 * `{userData.email}` in this component publishes every address on the site
 * again — that is exactly how `wulfovo@gmail.com` was readable on
 * /profile/382. The resolver tests cover the API side (`User.email` is only
 * returned to the owner and to staff); this covers the screen.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, params?: { count?: number; age?: number }) =>
            params?.count != null
                ? `${key}:${params.count}`
                : params?.age != null
                  ? `${key}:${params.age}`
                  : key,
    }),
}))

let UserDetailPanel: typeof import('../UserDetailPanel').default

beforeAll(async () => {
    UserDetailPanel = (await import('../UserDetailPanel')).default
})

/**
 * The shape the API answers with: a bio for everyone, the email only for your
 * own account. The component must not have a place to put the email at all.
 */
const userData = {
    id: '382',
    name: 'Radovan Vlk',
    nickname: 'Wulf',
    email: 'wulfovo@gmail.com',
    birthDate: '1976-01-01',
    description: '<p>Hraju larpy od roku 1993.</p>',
    amountOfPlayed: 46,
    amountOfCreated: 1,
}

describe('profile header', () => {
    it('shows the nickname, the name and the bio', async () => {
        render(<UserDetailPanel userData={userData} />)

        expect(screen.getByText(/Wulf/)).toBeTruthy()
        expect(await screen.findByText(/Hraju larpy od roku 1993/)).toBeTruthy()
    })

    it('never prints the account email, not even for a profile that carries one', () => {
        const { container } = render(<UserDetailPanel userData={userData} />)

        expect(container.textContent).not.toContain('@')
        expect(container.textContent).not.toContain('wulfovo')
    })

    it('copes with a profile without a bio', () => {
        const { container } = render(
            <UserDetailPanel userData={{ ...userData, description: null }} />,
        )

        expect(container.textContent).toContain('Wulf')
        expect(container.querySelector('[class*=description]')).toBeNull()
    })
})

describe('the queries behind the profile', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const publicProfileFiles = [
        join(here, '../OtherUserProfileContainer.tsx'),
        join(here, '../graphql/fragments.graphql'),
    ]

    it.each(publicProfileFiles)('does not ask the API for the email: %s', (file) => {
        expect(readFileSync(file, 'utf-8')).not.toMatch(/\bemail\b/)
    })

    // The other half of the rule: your own settings keep working, so the form
    // that edits the address still has it.
    it('keeps the email in the settings query', () => {
        const source = readFileSync(join(here, '../graphql/loadCurrentUserSettings.graphql'), 'utf-8')

        expect(source).toMatch(/\bemail\b/)
    })

    it('keeps the bio in the settings query, so the form can edit it', () => {
        const source = readFileSync(join(here, '../graphql/loadCurrentUserSettings.graphql'), 'utf-8')

        expect(source).toMatch(/\bdescription\b/)
    })
})
