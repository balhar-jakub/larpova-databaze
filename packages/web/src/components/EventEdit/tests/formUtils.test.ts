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

const { validate, toInitialValues, createInputFromValues, emptyInitialValues } = await import('../formUtils')

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

describe('toInitialValues', () => {
    it('maps a loaded event into form values, splitting games and labels', () => {
        const event = {
            id: 'e1',
            name: 'Festival',
            from: '2026-05-01T10:00:00',
            to: '2026-05-03T18:00:00',
            amountOfPlayers: 40,
            web: 'https://akce.test',
            registrationUrl: null,
            registrationStatus: '',
            registrationOpensAt: null,
            loc: 'Praha',
            description: '<p>popis</p>',
            games: [{ id: 'g1', name: 'Dračí doupě', year: 2014 }],
            labels: [
                { id: 'l1', name: 'svět', isRequired: true },
                { id: 'l2', name: 'fantasy', isRequired: false },
            ],
        }
        const values = toInitialValues(event as never)

        expect(values.name).toBe('Festival')
        expect(values.games).toEqual([
            { id: 'g1', name: 'Dračí doupě', itemLabel: '' },
        ])
        expect(values.requiredLabels).toEqual(['l1'])
        expect(values.optionalLabels).toEqual(['l2'])
    })

    it('survives an event without games and labels', () => {
        const values = toInitialValues({
            id: 'e2', name: 'Akce', from: null, to: null, games: null, labels: null,
        } as never)

        expect(values.games).toEqual([])
        expect(values.requiredLabels).toEqual([])
        expect(values.optionalLabels).toEqual([])
    })
})

describe('createInputFromValues', () => {
    it('builds the CreateEventInput from the form values', () => {
        const input = createInputFromValues(emptyInitialValues)
        expect(input).toBeTruthy()
        expect(input.name).toBe(emptyInitialValues.name)
    })
})

describe('branch arms of the form utils', () => {
    it('parseMinutes: midnight reads as 0, so equal zero-times count as inverted', () => {
        // "0:0" is a VALID time per validateTime (digits:digits) and parses as
        // 0 minutes — the >= guard fires on the same day.
        const res = validate(t)({
            ...baseValues,
            fromDate: date('2026-05-01'),
            toDate: date('2026-05-01'),
            fromTime: '0:0',
            toTime: '0:0',
        })
        expect(res.toTime).toBe('EventEdit.timeMismatch')
    })

    it('the same-day equal times read as inverted (>=, not >)', () => {
        const res = validate(t)({
            ...baseValues,
            fromDate: date('2026-05-01'),
            toDate: date('2026-05-01'),
            fromTime: '10:00',
            toTime: '10:00',
        })
        expect(res.toTime).toBe('EventEdit.timeMismatch')
    })

    it('an UPCOMING registration builds its opens-at from date and time', () => {
        const input = createInputFromValues({
            ...baseValues,
            registrationStatus: 'UPCOMING',
            registrationOpensDate: date('2026-04-01'),
            registrationOpensTime: '09:30',
        })
        expect(input.registrationOpensAt).toBe('2026-04-01T09:30:00')

        // Without a date: no opens-at at all (the undefined arm).
        const noDate = createInputFromValues({
            ...baseValues,
            registrationStatus: 'UPCOMING',
            registrationOpensDate: undefined,
        })
        expect(noDate.registrationOpensAt).toBeUndefined()

        // A CLOSED registration ignores the fields entirely.
        const closed = createInputFromValues({
            ...baseValues,
            registrationStatus: 'CLOSED',
            registrationOpensDate: date('2026-04-01'),
        })
        expect(closed.registrationOpensAt).toBeUndefined()
    })

    it('the amount of players parses only when present', () => {
        const withAmount = createInputFromValues({ ...baseValues, amountOfPlayers: '40' })
        expect(withAmount.amountOfPlayers).toBe(40)
        const without = createInputFromValues({ ...baseValues, amountOfPlayers: '' })
        expect(without.amountOfPlayers).toBeUndefined()
    })

    it('toInitialValues maps a null name and a game without a year', () => {
        const values = toInitialValues({
            id: 'e3',
            name: null,
            from: '2026-05-01T10:00:00',
            to: null,
            games: [{ id: 'g2', name: null, year: null }],
            labels: [],
        } as never)

        expect(values.name).toBe('')
        expect(values.games[0]?.name).toBe('')
    })
})
