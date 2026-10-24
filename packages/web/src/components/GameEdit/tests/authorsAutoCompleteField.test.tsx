/**
 * @jest-environment jsdom
 */
/**
 * The authors autocomplete field of the game edit form: search maps users
 * to author items with formatted labels, "create new" opens the modal and
 * adds the created author to the field value.
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

const refetchArgs: Array<Record<string, unknown>> = []
let usersByQuery: Array<{ id: string; name: string; nickname?: string | null }> = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({
        loading: false,
        refetch: (vars: Record<string, unknown>) => {
            refetchArgs.push(vars)
            return Promise.resolve({ data: { usersByQuery } })
        },
    }),
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => ({
        userProfile: (id: string) => ({ href: `/profile?id=${id}`, as: `/profil/${id}` }),
        push: () => undefined,
    }),
}))
jest.unstable_mockModule('../../common/form/FormAutoCompleteField', () => ({
    default: ({ onSearch, onCreateNew, placeholder, createNewText, entityLinkText }: { onSearch: (q: string) => Promise<unknown[]>; onCreateNew: () => void; placeholder?: string; createNewText?: string; entityLinkText?: string }) => (
        <div>
            <input placeholder={placeholder} data-testid="ac-input" />
            <button type="button" onClick={() => onSearch('jak')} data-testid="ac-search">search</button>
            <button type="button" onClick={onCreateNew} data-testid="ac-create">{createNewText}</button>
            <span data-testid="ac-link-text">{entityLinkText}</span>
        </div>
    ),
}))
jest.unstable_mockModule('../NewAuthorModal', () => ({
    formatAuthorLabel: ({ name, nickname }: { name: string; nickname?: string | null }) => `${name}${nickname ? ` (${nickname})` : ''}`,
    default: ({ onAddAuthor, onHide }: { onAddAuthor: (a: unknown) => void; onHide: () => void }) => (
        <div data-testid="new-author-modal">
            <button type="button" onClick={() => onAddAuthor({ id: 'u9', name: 'Nový Autor', nickname: undefined, itemLabel: 'Nový Autor' })}>add</button>
            <button type="button" onClick={onHide}>close</button>
        </div>
    ),
}))

let AuthorsAutoCompleteField: typeof import('../AuthorsAutoCompleteField')['default']
let Form: typeof import('react-final-form')['Form']

beforeAll(async () => {
    AuthorsAutoCompleteField = (await import('../AuthorsAutoCompleteField')).default
    Form = (await import('react-final-form')).Form
})

beforeEach(() => {
    cleanup()
    refetchArgs.length = 0
    usersByQuery = []
})

const renderField = () =>
    render(
        <Form onSubmit={() => undefined} initialValues={{ authors: [] } as never}>
            {() => <AuthorsAutoCompleteField name="authors" placeholder="Autoři" />}
        </Form>,
    )

describe('AuthorsAutoCompleteField', () => {
    it('searches users and maps them to items with formatted labels', async () => {
        usersByQuery = [{ id: 'u1', name: 'Jakub Balhar', nickname: 'Balda' }]
        renderField()

        fireEvent.click(screen.getByTestId('ac-search'))
        await act(async () => { await Promise.resolve() })

        expect(refetchArgs[0]).toMatchObject({ query: 'jak', offset: 0, limit: 7 })
        expect(screen.getByTestId('ac-link-text').textContent).toBeTruthy()
    })

    it('opens the create-new modal and adds the created author to the value', async () => {
        renderField()

        fireEvent.click(screen.getByTestId('ac-create'))
        await waitFor(() => expect(screen.getByTestId('new-author-modal')).toBeTruthy())

        fireEvent.click(screen.getByText('add'))
        await act(async () => { await Promise.resolve() })
        expect(screen.queryByTestId('new-author-modal')).toBeNull()
    })

    it('closes the modal without changes on hide', async () => {
        renderField()

        fireEvent.click(screen.getByTestId('ac-create'))
        fireEvent.click(screen.getByText('close'))
        expect(screen.queryByTestId('new-author-modal')).toBeNull()
    })
})
