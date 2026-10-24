/**
 * @jest-environment jsdom
 */
/**
 * GraphQLErrorContent: maps the error class to the localized message with
 * the value path interpolated, and unknown classes fall back to UNKNOWN.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

let GraphQLErrorContent: typeof import('../GraphQLErrorContent').default
let PropsFromGraphQLError: typeof import('../GraphQLErrorContent').PropsFromGraphQLError

beforeAll(async () => {
    ;({ default: GraphQLErrorContent, PropsFromGraphQLError } = await import('../GraphQLErrorContent'))
})

beforeEach(() => cleanup())

describe('GraphQLErrorContent', () => {
    it('renders the localized message per error class', () => {
        render(<GraphQLErrorContent errorClass="NETWORK" />)
        expect(screen.getByText(translate(cs, 'GraphQLError.NETWORK'))).toBeTruthy()
    })

    it('interpolates the value path into the message', () => {
        render(<GraphQLErrorContent errorClass="INVALID_VALUE" valuePath="name" />)
        expect(screen.getByText(translate(cs, 'GraphQLError.INVALID_VALUE', { valuePath: 'name' }))).toBeTruthy()
    })

    it('falls back to UNKNOWN for classes without a message', () => {
        render(<GraphQLErrorContent errorClass="SOMETHING_ELSE" />)
        expect(screen.getByText(translate(cs, 'GraphQLError.UNKNOWN'))).toBeTruthy()
    })

    it('derives the class from the GraphQL error extensions', () => {
        expect(PropsFromGraphQLError({ extensions: { code: 'ACCESS_DENIED' } })).toEqual({
            errorClass: 'ACCESS_DENIED',
            valuePath: undefined,
        })
        expect(PropsFromGraphQLError({ extensions: {} })).toEqual({ errorClass: 'UNKNOWN', valuePath: undefined })
        expect(PropsFromGraphQLError(undefined)).toEqual({ errorClass: 'UNKNOWN', valuePath: undefined })
    })
})
