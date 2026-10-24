/**
 * @jest-environment jsdom
 */
/**
 * The detail label list: each label links to the catalog filtered by it
 * (required labels in all-mode, optional in any-label mode); the events
 * variant links to the calendar without a filter.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        games: () => ({ href: '/katalog', as: '/katalog' }),
        calendar: () => ({ href: '/kalendar', as: '/kalendar' }),
    }),
}))
// passHref: the real Link forwards its href onto the child anchor.
jest.unstable_mockModule('next/link', () => ({
    default: ({ href, children }: { href: string; children: React.ReactElement }) =>
        React.cloneElement(children, { href }),
}))

let DetailLabelList: typeof import('../DetailLabelList').default

beforeAll(async () => {
    DetailLabelList = (await import('../DetailLabelList')).default
})

beforeEach(() => cleanup())

const labels = [
    { id: '1', name: 'svět', description: 'Svět hry', isRequired: true },
    { id: '2', name: 'fantasy', description: null, isRequired: false },
]

describe('DetailLabelList', () => {
    it('links required labels to the all-mode catalog filter', () => {
        render(<DetailLabelList labels={labels} linkType="games" />)

        const requiredLink = screen.getByText('svět').closest('a')
        expect(requiredLink?.getAttribute('href')).toBe('/katalog?labels=1')
        expect(requiredLink?.getAttribute('title')).toBe('Svět hry')
    })

    it('links optional labels with the any-label mode', () => {
        render(<DetailLabelList labels={labels} linkType="games" />)

        expect(screen.getByText('fantasy').closest('a')?.getAttribute('href')).toBe('/katalog?labels=2&mode=any')
    })

    it('links to the calendar without a filter in the events variant', () => {
        render(<DetailLabelList labels={labels} linkType="events" />)

        const link = screen.getByText('svět').closest('a')
        expect(link?.getAttribute('href')).toBe('/kalendar')
    })
})
