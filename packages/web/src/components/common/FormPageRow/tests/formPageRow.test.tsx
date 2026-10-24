/**
 * @jest-environment jsdom
 */
/**
 * The form page row: optional header bar and the white body.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

jest.unstable_mockModule('../../WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let FormPageRow: typeof import('../FormPageRow').default

beforeAll(async () => {
    FormPageRow = (await import('../FormPageRow')).default
})

beforeEach(() => cleanup())

describe('FormPageRow', () => {
    it('renders the header when given', () => {
        render(<FormPageRow headerText="Nová hra"><div>tělo</div></FormPageRow>)

        expect(screen.getByText('Nová hra')).toBeTruthy()
        expect(screen.getByText('tělo')).toBeTruthy()
    })

    it('renders without a header', () => {
        const { container } = render(<FormPageRow><div>tělo</div></FormPageRow>)

        expect(container.textContent).toBe('tělo')
    })
})
