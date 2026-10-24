/**
 * @jest-environment jsdom
 */
/**
 * The header navigation link: plain strings render as external anchors
 * with the target, route objects render as Next links that hide the
 * in-place login on click.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

const hideInPlaceLogin = jest.fn()

jest.unstable_mockModule('src/hooks/useHideInPlaceLogin', () => ({
    useHideInPlaceLogin: () => hideInPlaceLogin,
}))
// passHref: the real Link forwards its href onto the child anchor.
jest.unstable_mockModule('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactElement }) =>
        React.cloneElement(children, { href }),
}))

let HeaderNavLink: typeof import('../HeaderNavLink').HeaderNavLink

beforeAll(async () => {
    HeaderNavLink = (await import('../HeaderNavLink')).HeaderNavLink
})

beforeEach(() => {
    cleanup()
    jest.clearAllMocks()
})

describe('HeaderNavLink', () => {
    it('renders a string route as an external anchor with the target', () => {
        render(<HeaderNavLink route="https://example.test" target="_blank">wiki</HeaderNavLink>)

        const link = screen.getByText('wiki').closest('a')
        expect(link?.getAttribute('href')).toBe('https://example.test')
        expect(link?.getAttribute('target')).toBe('_blank')
    })

    it('renders a route object as an internal link and hides in-place login on click', () => {
        render(
            <HeaderNavLink route={{ href: '/kalendar', as: '/kalendar' }}>
                kalendář
            </HeaderNavLink>,
        )

        const link = screen.getByText('kalendář').closest('a')
        expect(link?.getAttribute('href')).toBe('/kalendar')
        expect(link?.getAttribute('target')).toBeNull()

        fireEvent.click(link!)
        expect(hideInPlaceLogin).toHaveBeenCalledTimes(1)
    })
})
