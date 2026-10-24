/**
 * @jest-environment jsdom
 */
/**
 * The profile area: the change-password page (mutation, old-password
 * error path, mismatch validation) and the user settings page (loads the
 * current user, submits the update mutation and redirects).
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

const mutationCalls: Array<{ variables?: Record<string, unknown> }> = []
const toasts: Array<{ text: unknown; type: string }> = []
let pushedRoute = ''
let mutateResult: Promise<unknown> = Promise.resolve({})
let queryData: Record<string, unknown> | undefined
let queryError: unknown
let usedByUser: { id: string; name?: string } | undefined

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: queryData, loading: false }),
    useApolloClient: () => ({
        mutate: (opts: { variables?: Record<string, unknown> }) => {
            mutationCalls.push(opts)
            return mutateResult
        },
        resetStore: () => undefined,
    }),
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: unknown, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = { currentProfile: () => '/muj-profil' }
        return { ...routes, push: (url: string) => { pushedRoute = url } }
    },
}))
jest.unstable_mockModule('src/hooks/useIsEmailAvailable', () => ({
    useIsEmailAvailable: () => ({ usedByUser, isEmailAvailable: async () => !usedByUser }),
}))
jest.unstable_mockModule('../UserDetailPanel', () => ({
    default: ({ userData }: { userData?: { name?: string | null } }) => <div data-testid="user-detail">{userData?.name ?? 'anon'}</div>,
}))
jest.unstable_mockModule('../UserProfileTabs', () => ({
    default: ({ selectedTab }: { selectedTab: string }) => <div data-testid={`profile-tabs-${selectedTab}`} />,
}))
jest.unstable_mockModule('../../common/FormPageRow/FormPageRow', () => ({
    default: ({ children, headerText }: { children: React.ReactNode; headerText?: string }) => (
        <div><h1>{headerText}</h1>{children}</div>
    ),
}))
jest.unstable_mockModule('../../common/SubmitButton/SubmitButton', () => ({
    default: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../common/GraphQLErrorContent/GraphQLErrorContent', () => ({
    default: () => <div>graphql-error</div>,
    PropsFromGraphQLError: () => ({ errorClass: 'x', valuePath: 'y' }),
}))

import { createRequire } from 'node:module'
const draftRequire = createRequire(import.meta.url)
jest.unstable_mockModule('draft-js', () => draftRequire('draft-js'))
jest.unstable_mockModule('draft-js-buttons', () => draftRequire('draft-js-buttons'))
jest.unstable_mockModule('react-bootstrap-icons', () => draftRequire('react-bootstrap-icons'))
jest.unstable_mockModule('react-datepicker', () => ({
    registerLocale: () => undefined,
    default: ({ customInput, placeholderText }: { customInput?: React.ReactElement; placeholderText?: string }) =>
        customInput ? React.cloneElement(customInput, { placeholder: placeholderText }) : <input placeholder={placeholderText} />,
}))
jest.unstable_mockModule('../../common/form/FormAutoCompleteField', () => ({
    default: ({ placeholder }: { placeholder?: string }) => <div><input placeholder={placeholder} /></div>,
}))

let ChangePasswordPanel: typeof import('../ChangePasswordPanel')['default']
let UserSettingsPanel: typeof import('../UserSettingsPanel')['default']

beforeAll(async () => {
    ChangePasswordPanel = (await import('../ChangePasswordPanel')).default
    UserSettingsPanel = (await import('../UserSettingsPanel')).default
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    pushedRoute = ''
    mutateResult = Promise.resolve({})
    queryError = undefined
    usedByUser = undefined
    queryData = {
        loggedInUser: {
            __typename: 'User',
            id: '1',
            email: 'jakub@example.test',
            name: 'Jakub',
            nickname: null,
            city: 'Praha',
            birthDate: null,
            gender: 'MALE',
            description: null,
            image: null,
        },
    }
})

describe('ChangePasswordPanel', () => {
    jest.setTimeout(15000)
    it('renders the form fields and submits the change', async () => {
        render(<ChangePasswordPanel />)
        expect(screen.getByTestId('user-detail').textContent).toBe('Jakub')
        expect(screen.getByTestId('profile-tabs-changePassword')).toBeTruthy()

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.oldPassword')), { target: { value: 'staré' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.newPassword')), { target: { value: 'nové' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.newPasswordAgain')), { target: { value: 'nové' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(pushedRoute).toBe('/muj-profil'), { timeout: 5000 })
        expect(mutationCalls[0]?.variables).toEqual({ oldPassword: 'staré', newPassword: 'nové' })
        expect(toasts[0]?.type).toBe('success')
    })

    it('flags the old-password error when the server rejects it', async () => {
        mutateResult = Promise.reject({
            graphQLErrors: [{ extensions: { path: 'oldPassword' } }],
        })
        render(<ChangePasswordPanel />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.oldPassword')), { target: { value: 'špatné' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.newPassword')), { target: { value: 'nové' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.newPasswordAgain')), { target: { value: 'nové' } })
        fireEvent.submit(document.querySelector('form')!)

        // The state flips after the mutation fails; the error shows on the
        // next validation pass (submit). Re-submit inside waitFor so the
        // retry loop tolerates the rejection handler not having run yet.
        await waitFor(() => {
            fireEvent.submit(document.querySelector('form')!)
            expect(screen.getByText(translate(cs, 'ChangePassword.oldPasswordError'))).toBeTruthy()
        }, { timeout: 5000 })
        expect(pushedRoute).toBe('')
    })

    it('shows a toast for other GraphQL errors', async () => {
        mutateResult = Promise.reject({ graphQLErrors: [{ extensions: {} }] })
        render(<ChangePasswordPanel />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.oldPassword')), { target: { value: 'staré' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.newPassword')), { target: { value: 'nové' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.newPasswordAgain')), { target: { value: 'nové' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(toasts[0]?.type).toBe('alert'), { timeout: 5000 })
    })

    it('requires matching new passwords', () => {
        render(<ChangePasswordPanel />)

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.oldPassword')), { target: { value: 'staré' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.newPassword')), { target: { value: 'nové' } })
        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'ChangePassword.newPasswordAgain')), { target: { value: 'jiné' } })
        fireEvent.submit(document.querySelector('form')!)

        expect(mutationCalls.length).toBe(0)
        expect(screen.getByText(translate(cs, 'ChangePassword.passwordAgainError'))).toBeTruthy()
    })
})

describe('UserSettingsPanel', () => {
    jest.setTimeout(15000)
    it('renders the settings form with the current values and saves', async () => {
        render(<UserSettingsPanel />)
        expect(screen.getByPlaceholderText(translate(cs, 'UserFields.email'))).toBeTruthy()

        fireEvent.change(screen.getByPlaceholderText(translate(cs, 'UserFields.name')), { target: { value: 'Jakub Nový' } })
        fireEvent.submit(document.querySelector('form')!)

        await waitFor(() => expect(pushedRoute).toBe('/muj-profil'), { timeout: 5000 })
        const variables = mutationCalls[0]?.variables as { input?: Record<string, unknown> } | undefined
        expect(variables?.input?.name).toBe('Jakub Nový')
        expect(toasts[0]?.type).toBe('success')
    })

    it('shows the loading state until the user is loaded', () => {
        queryData = undefined
        render(<UserSettingsPanel />)
        expect(screen.getByText('loading')).toBeTruthy()
    })
})
