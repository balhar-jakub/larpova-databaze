import { jest } from '@jest/globals'
import { TFunction } from 'i18next'

jest.unstable_mockModule('../common/form/richTextInputUtils', () => ({
    editorStateToHtml: (value?: string) => value,
}))

jest.unstable_mockModule('./GamesAutoCompleteField', () => ({
    createGameLabel: ({ name, year }: { name?: string | null; year?: number | null }) =>
        year ? `${name} (${year})` : name ?? '',
}))

let formUtils: typeof import('./formUtils')

beforeAll(async () => {
    formUtils = await import('./formUtils')
})

const t = ((key: string) => key) as TFunction

describe('event registration form values', () => {
    it('includes the registration state in mutation input', () => {
        const input = formUtils.createInputFromValues({
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
            registrationUrl: 'https://example.test/signup',
            registrationOpen: true,
        })

        expect(input.registrationUrl).toBe('https://example.test/signup')
        expect(input.registrationOpen).toBe(true)
    })

    it('restores the registration state when editing an event', () => {
        const initial = formUtils.toInitialValues({
            id: '1',
            name: 'Test event',
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-10-02T00:00:00.000Z',
            registrationUrl: 'https://example.test/signup',
            registrationOpen: true,
            loc: null,
            web: null,
            description: null,
            amountOfPlayers: null,
            games: [],
            labels: [],
        })

        expect(initial.registrationUrl).toBe('https://example.test/signup')
        expect(initial.registrationOpen).toBe(true)
    })

    it('requires a URL when registration is open', () => {
        const errors = formUtils.validate(t)({
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
            registrationOpen: true,
        })

        expect(errors.registrationUrl).toBe('EventEdit.registrationUrlRequiredWhenOpen')
    })

    it('rejects a non-HTTP registration URL', () => {
        const errors = formUtils.validate(t)({
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
            registrationUrl: 'javascript:alert(1)',
            registrationOpen: false,
        })

        expect(errors.registrationUrl).toBe('Errors.invalidUrl')
    })
})
