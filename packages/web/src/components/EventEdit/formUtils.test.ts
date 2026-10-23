import { jest } from '@jest/globals'
import { type Translator } from 'src/lib/i18n'
import { RegistrationStatus } from '../../graphql/__generated__/typescript-operations'

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

const t = ((key: string) => key) as Translator

describe('event registration form values', () => {
    it('includes the registration state in mutation input', () => {
        const input = formUtils.createInputFromValues({
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
            registrationUrl: 'https://example.test/signup',
            registrationStatus: RegistrationStatus.Open,
        })

        expect(input.registrationUrl).toBe('https://example.test/signup')
        expect(input.registrationStatus).toBe('OPEN')
    })

    it('sends no status when none was picked', () => {
        const input = formUtils.createInputFromValues({
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
        })

        expect(input.registrationStatus).toBeUndefined()
    })

    it('sends the opens-at time only for UPCOMING', () => {
        const base = {
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
            registrationOpensDate: new Date('2026-10-20'),
            registrationOpensTime: '10:30',
        }

        expect(formUtils.createInputFromValues({ ...base, registrationStatus: RegistrationStatus.Upcoming }).registrationOpensAt)
            .toBe('2026-10-20T10:30:00')
        expect(formUtils.createInputFromValues({ ...base, registrationStatus: RegistrationStatus.Open }).registrationOpensAt)
            .toBeUndefined()
    })

    it('restores the registration state when editing an event', () => {
        const initial = formUtils.toInitialValues({
            id: '1',
            name: 'Test event',
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-10-02T00:00:00.000Z',
            registrationUrl: 'https://example.test/signup',
            registrationStatus: RegistrationStatus.Open,
            registrationOpensAt: null,
            loc: null,
            web: null,
            description: null,
            amountOfPlayers: null,
            games: [],
            labels: [],
        })

        expect(initial.registrationUrl).toBe('https://example.test/signup')
        expect(initial.registrationStatus).toBe('OPEN')
    })

    it('restores the opens-at fields for an upcoming event', () => {
        const initial = formUtils.toInitialValues({
            id: '1',
            name: 'Test event',
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-10-02T00:00:00.000Z',
            registrationUrl: null,
            registrationStatus: RegistrationStatus.Upcoming,
            registrationOpensAt: '2026-10-20T10:30:00.000Z',
            loc: null,
            web: null,
            description: null,
            amountOfPlayers: null,
            games: [],
            labels: [],
        })

        expect(initial.registrationStatus).toBe('UPCOMING')
        expect(initial.registrationOpensDate?.toISOString().startsWith('2026-10-20')).toBe(true)
        expect(initial.registrationOpensTime).toBe('10:30')
    })

    it('treats a legacy open event without a status as no status', () => {
        const initial = formUtils.toInitialValues({
            id: '1',
            name: 'Test event',
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-10-02T00:00:00.000Z',
            registrationUrl: null,
            registrationStatus: null,
            registrationOpensAt: null,
            loc: null,
            web: null,
            description: null,
            amountOfPlayers: null,
            games: [],
            labels: [],
        })

        expect(initial.registrationStatus).toBe('')
    })

    it('requires a URL when registration is open', () => {
        const errors = formUtils.validate(t)({
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
            registrationStatus: 'OPEN',
        })

        expect(errors.registrationUrl).toBe('EventEdit.registrationUrlRequiredWhenOpen')
    })

    it('does not require a URL when registration is upcoming', () => {
        const errors = formUtils.validate(t)({
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
            registrationStatus: 'UPCOMING',
        })

        expect(errors.registrationUrl).toBeUndefined()
    })

    it('rejects a non-HTTP registration URL', () => {
        const errors = formUtils.validate(t)({
            ...formUtils.emptyInitialValues,
            name: 'Test event',
            fromDate: new Date('2026-10-01'),
            toDate: new Date('2026-10-02'),
            registrationUrl: 'javascript:alert(1)',
            registrationStatus: '',
        })

        expect(errors.registrationUrl).toBe('Errors.invalidUrl')
    })
})
