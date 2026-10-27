/**
 * @jest-environment jsdom
 */
/**
 * FormPanel: the white rounded container the forms sit in.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

let FormPanel: typeof import('../FormPanel').default

beforeAll(async () => {
    FormPanel = (await import('../FormPanel')).default
})

beforeEach(() => cleanup())

describe('FormPanel', () => {
    it('wraps its children', () => {
        render(<FormPanel><div>tělo formuláře</div></FormPanel>)

        expect(screen.getByText('tělo formuláře')).toBeTruthy()
    })
})
