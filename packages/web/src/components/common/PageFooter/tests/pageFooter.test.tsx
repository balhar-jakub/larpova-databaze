/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest, describe, it, expect, beforeAll } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

/**
 * The footer carries the privacy-policy link, and Google will not publish the OAuth
 * app without one on the public site — so this is a compliance detail with a build
 * failure waiting to happen if the link or its label disappears.
 */

const cs = JSON.parse(
    readFileSync(
        fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)),
        'utf-8',
    ),
)

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

let PageFooter: typeof import('../PageFooter').PageFooter

beforeAll(async () => {
    PageFooter = (await import('../PageFooter')).PageFooter
})

describe('PageFooter', () => {
    it('links the privacy policy on every page', () => {
        render(<PageFooter />)

        const link = screen.getByRole('link', { name: cs.PageFooter.privacy })
        expect(link.getAttribute('href')).toBe('/ochrana-osobnich-udaju')
    })

    it('still carries the copyright and the team', () => {
        render(<PageFooter />)

        expect(screen.getByText(cs.PageFooter.copyright)).toBeTruthy()
        expect(screen.getByText(cs.PageFooter.team)).toBeTruthy()
    })
})
