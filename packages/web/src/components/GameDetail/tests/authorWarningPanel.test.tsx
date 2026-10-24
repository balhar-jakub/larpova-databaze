/**
 * @jest-environment jsdom
 */
/**
 * The author warning panel: gender-aware wording of the warning and the
 * dismiss button that reports back.
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

let loggedInGender: string | undefined = undefined

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('src/hooks/useLoggedInUser', () => ({
    useLoggedInUser: () => ({ id: 'u1', gender: loggedInGender }),
}))

let AuthorWarningPanel: typeof import('../AuthorWarningPanel').default

beforeAll(async () => {
    AuthorWarningPanel = (await import('../AuthorWarningPanel')).default
})

beforeEach(() => {
    cleanup()
    loggedInGender = undefined
})

describe('AuthorWarningPanel', () => {
    it('warns with the neutral wording for an unknown gender', () => {
        render(<AuthorWarningPanel onDismiss={() => undefined} />)

        expect(screen.getByText(translate(cs, 'GameDetail.ownRatingWarning', { context: 'other' }))).toBeTruthy()
    })

    it('warns with the male wording when the author states his gender', () => {
        loggedInGender = 'MALE'
        render(<AuthorWarningPanel onDismiss={() => undefined} />)

        expect(screen.getByText(translate(cs, 'GameDetail.ownRatingWarning', { context: 'male' }))).toBeTruthy()
    })

    it('reports the dismiss', () => {
        const onDismiss = jest.fn()
        render(<AuthorWarningPanel onDismiss={onDismiss} />)

        fireEvent.click(screen.getByText(translate(cs, 'GameDetail.ownRatingWarningDismiss')))

        expect(onDismiss).toHaveBeenCalledTimes(1)
    })
})
