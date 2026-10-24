/**
 * The event form's validation rules: required dates, valid times, the
 * both-times rule, date/time ordering, and the registration URL rules.
 */
import { jest } from '@jest/globals'

// formUtils imports draft-js and rich text utils; give them minimal stand-ins.
jest.unstable_mockModule('draft-js', () => ({
    EditorState: { createEmpty: () => ({}), createWithContent: () => ({}) },
}))
jest.unstable_mockModule('../../common/form/richTextInputUtils', () => ({
    editorStateToHtml: () => '<p>html</p>',
}))
jest.unstable_mockModule('../GamesAutoCompleteField', () => ({
    createGameLabel: () => '',
    LinkedGame: {},
}))
jest.unstable_mockModule('../../common/form/NewLabelsField', () => ({
    NewLabel: {},
}))

// Keys only; the messages themselves do not matter for these rules.
const t = (key: string) => key

const { validate } = await import('../formUtils')

const date = (iso: string) => new Date(iso)

const baseValues = {
    name: 'Festival',
    fromDate: date('2026-05-01'),
    toDate: date('2026-05-02'),
    fromTime: '10:00',
    toTime: '18:00',
    amountOfPlayers: '120',
    web: '',
    loc: '',
    registrationUrl: '',
    registrationStatus: 'CLOSED' as const,
    registrationOpensDate: undefined,
    registrationOpensTime: '',
    description: {},
    games: [],
    requiredLabels: [],
    optionalLabels: [],
    newLabels: [],
    coverImage: '',
}

describe('event form validate', () => {
    it('passes a complete form', () => {
        expect(validate(t)(baseValues)).toEqual({})
    })

    it('requires both dates and rejects invalid times', () => {
        const res = validate(t)({ ...baseValues, fromDate: undefined, toDate: undefined, fromTime: '25:99' })

        expect(res.fromDate).toBe('Errors.required')
        expect(res.toDate).toBe('Errors.required')
        expect(res.fromTime).toBe('Errors.invalidTime')
    })

    it('demands both times when either is set', () => {
        const onlyFrom = validate(t)({ ...baseValues, toTime: '' })
        const onlyTo = validate(t)({ ...baseValues, fromTime: '' })

        expect(onlyFrom.toTime).toBe('EventEdit.fillBothTimes')
        expect(onlyTo.fromTime).toBe('EventEdit.fillBothTimes')
    })

    it('rejects an end before the start and same-day time inversion', () => {
        const swapped = validate(t)({
            ...baseValues,
            fromDate: date('2026-05-03'),
            toDate: date('2026-05-02'),
        })
        expect(swapped.toDate).toBe('EventEdit.dateMismatch')

        const sameDay = validate(t)({
            ...baseValues,
            fromDate: date('2026-05-01'),
            toDate: date('2026-05-01'),
            fromTime: '18:00',
            toTime: '10:00',
        })
        expect(sameDay.toTime).toBe('EventEdit.timeMismatch')
    })

    it('requires an absolute registration URL when registration is open', () => {
        const openNoUrl = validate(t)({ ...baseValues, registrationStatus: 'OPEN' })
        expect(openNoUrl.registrationUrl).toBe('EventEdit.registrationUrlRequiredWhenOpen')

        const openRelative = validate(t)({
            ...baseValues,
            registrationStatus: 'OPEN',
            registrationUrl: '/registrace',
        })
        expect(openRelative.registrationUrl).toBe('Errors.invalidUrl')

        const openAbsolute = validate(t)({
            ...baseValues,
            registrationStatus: 'OPEN',
            registrationUrl: 'https://registrace.example.test',
        })
        expect(openAbsolute.registrationUrl).toBeUndefined()
    })
})
