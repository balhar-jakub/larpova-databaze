/**
 * @jest-environment jsdom
 */
/**
 * The new-author modal of the game edit page: adding an author by email
 * (with the used-email hint offering to add the found user instead), the
 * required-name validation, and closing.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let emailAvailable = true
let usedByUser: { id: string; name?: string; nickname?: string | null; email?: string } | undefined = undefined
const addedAuthors: Array<import('../NewAuthorModal').Author> = []
let hideCalls = 0

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('src/hooks/useIsEmailAvailable', () => ({
    useIsEmailAvailable: () => ({ usedByUser, isEmailAvailable: async () => emailAvailable }),
}))
jest.unstable_mockModule('src/hooks/useFocusInput', () => ({ useFocusInput: () => ({ current: null }) }))
jest.unstable_mockModule('../../common/SubmitButton/SubmitButton', () => ({
    default: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}))

let NewAuthorModal: typeof import('../NewAuthorModal')['default']
let formatAuthorLabel: typeof import('../NewAuthorModal')['formatAuthorLabel']

beforeAll(async () => {
    NewAuthorModal = (await import('../NewAuthorModal')).default
    formatAuthorLabel = (await import('../NewAuthorModal')).formatAuthorLabel
})

beforeEach(() => {
    cleanup()
    addedAuthors.length = 0
    hideCalls = 0
    emailAvailable = true
    usedByUser = undefined
})

describe('formatAuthorLabel', () => {
    it('combines name and nickname', () => {
        expect(formatAuthorLabel({ name: 'Jakub', nickname: 'Balda' })).toContain('Jakub')
        expect(formatAuthorLabel({ name: 'Jakub', nickname: 'Balda' })).toContain('Balda')
        expect(formatAuthorLabel({ name: 'Jakub', nickname: null })).toContain('Jakub')
    })
})

describe('NewAuthorModal', () => {
    it('adds a new author with a free email and the formatted label', async () => {
        render(<NewAuthorModal onHide={() => { hideCalls += 1 }} onAddAuthor={(a: import('../NewAuthorModal').Author) => addedAuthors.push(a)} />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'NewAuthorModal.email')), { target: { value: 'novy@example.test' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'NewAuthorModal.name')), { target: { value: 'Nový Autor' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(addedAuthors.length).toBe(1))
        expect(addedAuthors[0]).toMatchObject({ email: 'novy@example.test', name: 'Nový Autor' })
        expect(String(addedAuthors[0].itemLabel)).toContain('Nový Autor')
        expect(hideCalls).toBe(0)
    })

    it('offers adding the found user when the email is already used', async () => {
        usedByUser = { id: '7', name: 'Existující', nickname: 'exista', email: 'stary@example.test' }
        render(<NewAuthorModal onHide={() => { hideCalls += 1 }} onAddAuthor={(a: import('../NewAuthorModal').Author) => addedAuthors.push(a)} />)

        fireEvent.blur(screen.getByPlaceholderText(translate(cs, 'NewAuthorModal.email')))

        const addFound = await screen.findByText(translate(cs, 'NewAuthorModal.addUser'))
        fireEvent.click(addFound)

        expect(addedAuthors.length).toBe(1)
        expect(addedAuthors[0]).toMatchObject({ id: '7', name: 'Existující', nickname: 'exista' })
    })

    it('rejects submitting with a used email via the form path', async () => {
        emailAvailable = false
        render(<NewAuthorModal onHide={() => { hideCalls += 1 }} onAddAuthor={(a: import('../NewAuthorModal').Author) => addedAuthors.push(a)} />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'NewAuthorModal.email')), { target: { value: 'obsazeny@example.test' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'NewAuthorModal.name')), { target: { value: 'Někdo' } })
        fireEvent.submit(document.querySelector('form')!)

        // The availability check rejects the submit: no author is added.
        await new Promise((r) => setTimeout(r, 20))
        expect(addedAuthors.length).toBe(0)
    })

    it('requires the name field', () => {
        render(<NewAuthorModal onHide={() => { hideCalls += 1 }} onAddAuthor={(a: import('../NewAuthorModal').Author) => addedAuthors.push(a)} />)

        fireEvent.submit(document.querySelector('form')!)
        expect(addedAuthors.length).toBe(0)
        expect(screen.getAllByText(translate(cs, 'Errors.required')).length).toBeGreaterThan(0)
    })

    it('closes via the cancel button', () => {
        render(<NewAuthorModal onHide={() => { hideCalls += 1 }} onAddAuthor={(a: import('../NewAuthorModal').Author) => addedAuthors.push(a)} />)

        fireEvent.click(screen.getByText(translate(cs, 'NewAuthorModal.cancel')))
        expect(hideCalls).toBe(1)
    })

    it('adds a found user without a nickname (the null arm)', async () => {
        usedByUser = { id: '9', name: 'Bez Přezdívky', nickname: null, email: 'stary2@example.test' }
        render(<NewAuthorModal onHide={() => { hideCalls += 1 }} onAddAuthor={(a: import('../NewAuthorModal').Author) => addedAuthors.push(a)} />)

        fireEvent.blur(screen.getByPlaceholderText(translate(cs, 'NewAuthorModal.email')))

        const addFound = await screen.findByText(translate(cs, 'NewAuthorModal.addUser'))
        fireEvent.click(addFound)

        expect(addedAuthors.length).toBe(1)
        expect(addedAuthors[0]).toMatchObject({ id: '9', name: 'Bez Přezdívky', nickname: undefined })
    })
})
