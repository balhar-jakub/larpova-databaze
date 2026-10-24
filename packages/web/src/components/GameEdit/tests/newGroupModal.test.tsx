/**
 * @jest-environment jsdom
 */
/**
 * The new-group modal of the game edit page: a required name, saving
 * reports the group back to the page, and cancel closes.
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

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const added: Array<{ name: string; itemLabel: string }> = []
let hideCalls = 0

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))

let NewGroupModal: typeof import('../NewGroupModal').default

beforeAll(async () => {
    NewGroupModal = (await import('../NewGroupModal')).default
})

beforeEach(() => {
    cleanup()
    added.length = 0
    hideCalls = 0
})

const renderModal = () =>
    render(<NewGroupModal onHide={() => { hideCalls += 1 }} onAddGroup={group => { added.push(group) }} />)

describe('NewGroupModal', () => {
    it('shows the title and the name field', () => {
        renderModal()

        expect(screen.getByText(translate(cs, 'NewGroupModal.title'))).toBeTruthy()
        expect(screen.getByPlaceholderText(translate(cs, 'NewGroupModal.name'))).toBeTruthy()
    })

    it('reports the typed group name on save and closes', async () => {
        renderModal()

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'NewGroupModal.name')), {
            target: { value: 'Dragon Games' },
        })
        fireEvent.click(screen.getByText(translate(cs, 'NewGroupModal.save')))

        // react-final-form submits asynchronously.
        await Promise.resolve()

        expect(added).toEqual([{ name: 'Dragon Games', itemLabel: 'Dragon Games' }])
    })

    it('closes without adding anything on cancel', () => {
        renderModal()

        fireEvent.click(screen.getByText(translate(cs, 'NewGroupModal.cancel')))

        expect(hideCalls).toBe(1)
        expect(added).toEqual([])
    })
})
