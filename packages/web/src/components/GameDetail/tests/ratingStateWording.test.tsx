/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'
import { Gender } from 'src/graphql/__generated__/typescript-operations'
import { UserContext } from 'src/context/UserContext/UserContext'

/**
 * The three play-state buttons stand next to each other on a game detail page,
 * and two of them say "I played": "Hrál jsem" for a man, "Hrála jsem" for a
 * woman, "Hrál/a jsem" for a visitor who is not signed in or did not state a
 * gender. The wording is asserted against the shipped Czech locale through the
 * real resolver, not against a fixture, so a lost `_female` key fails here.
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

const mutateCalls: Array<Record<string, unknown>> = []
jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({
        mutate: (opts: Record<string, unknown>) => {
            mutateCalls.push(opts)
            return Promise.resolve({})
        },
    }),
}))

// The component pulls its GraphQL document in with require(); ESM jest has no
// require, so give it a stub — the document only ever reaches the mocked client.
;(globalThis as unknown as { require: (path: string) => unknown }).require = () => ({})

let RatingStateButtons: typeof import('../RatingStateButtons').default

beforeAll(async () => {
    RatingStateButtons = (await import('../RatingStateButtons')).default
})

/** Empty object is how the app renders a still-loading user; it must stay neutral. */
const renderAs = (value?: { readonly gender?: Gender }) =>
    render(
        <UserContext.Provider value={{ value, actions: { reload: () => undefined } }}>
            <RatingStateButtons gameId="42" state={0} />
        </UserContext.Provider>,
    )

const wording = () => screen.getAllByRole('button').map(button => button.textContent)

describe('the play-state buttons speak in the gender of the signed-in user', () => {
    test('a woman reads Hrála jsem', () => {
        renderAs({ gender: Gender.Female })

        expect(wording()).toEqual(['Nehrála jsem', 'Hrála jsem', 'Chci hrát'])
    })

    test('a man reads Hrál jsem', () => {
        renderAs({ gender: Gender.Male })

        expect(wording()).toEqual(['Nehrál jsem', 'Hrál jsem', 'Chci hrát'])
    })

    test('a user who did not state a gender reads both forms', () => {
        renderAs({ gender: Gender.Unspecified })

        expect(wording()).toEqual(['Nehrál/a jsem', 'Hrál/a jsem', 'Chci hrát'])
    })

    test('a visitor without a loaded user reads both forms', () => {
        renderAs(undefined)

        expect(wording()).toEqual(['Nehrál/a jsem', 'Hrál/a jsem', 'Chci hrát'])
    })

    test('clicking a state button sends the update mutation', () => {
        cleanup()
        render(<RatingStateButtons gameId="g1" state={0} />)
        mutateCalls.length = 0

        fireEvent.click(screen.getByText('Chci hrát'))

        expect(mutateCalls.length).toBe(1)
        expect(mutateCalls[0].variables).toEqual({ gameId: 'g1', state: 1 })
    })
})
