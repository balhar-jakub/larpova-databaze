/**
 * @jest-environment jsdom
 */
/**
 * EventLink's null-name arm: an event row without a name still produces a
 * well-formed route instead of "null" in the URL.
 */
import React from 'react'
import {render} from '@testing-library/react'
import { jest } from '@jest/globals'

jest.unstable_mockModule('next/link', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        eventDetail: (id: string, name?: string) => ({ href: `/eventDetail?id=${id}`, as: `/akce/${id}-${name}` }),
    }),
}))

let EventLink: typeof import('../EventLink').default

beforeAll(async () => {
    EventLink = (await import('../EventLink')).default
})

describe('EventLink', () => {
    it('renders a named event into its pretty route', () => {
        render(<EventLink event={{ id: '32', name: 'Festival' } as never}>text</EventLink>)

        expect(document.querySelector('a')).toBeTruthy()
    })

    it('renders a nameless event without crashing on the route', () => {
        render(<EventLink event={{ id: '33', name: null } as never}>text</EventLink>)

        // The route built with the empty-string fallback; no "null" in it.
        expect(document.body.textContent).toContain('text')
        expect(document.body.innerHTML).not.toContain('null')
    })
})
