import { formatTimeRange, hasTimePart, parseDateTime } from '../dateUtils'

describe('parseDateTime', () => {
    test('parse undefined', () => {
        expect(parseDateTime()).toBeUndefined()
    })

    test('parse date', () => {
        expect(parseDateTime('2020-11-15')?.toString()).toEqual('Sun Nov 15 2020 00:00:00 GMT+0100 (GMT+01:00)')
    })

    test('parse date with time', () => {
        expect(parseDateTime('2020-11-13 23:00:00')?.toString()).toEqual(
            'Fri Nov 13 2020 23:00:00 GMT+0100 (GMT+01:00)',
        )
    })

    test('parse date with time in DST', () => {
        expect(parseDateTime('2020-07-10 05:00:00')?.toString()).toEqual(
            'Fri Jul 10 2020 05:00:00 GMT+0200 (GMT+02:00)',
        )
    })
})

describe('hasTimePart', () => {
    it('should return false for undefined', () => {
        expect(hasTimePart()).toBeFalsy()
    })

    it('should return true for date at 2AM', () => {
        expect(hasTimePart(parseDateTime('2020-08-13 02:00:00'))).toBeTruthy()
    })

    it('should return true for date without time', () => {
        expect(hasTimePart(parseDateTime('2020-08-13'))).toBeFalsy()
    })

    it('should return true for date at midnight', () => {
        expect(hasTimePart(parseDateTime('2020-12-13 00:00:00'))).toBeFalsy()
    })
})

describe('formatTimeRange', () => {
    test('empty input', () => {
        expect(formatTimeRange()).toEqual({
            justOneDate: true,
        })
    })

    test('same day', () => {
        expect(formatTimeRange('2020-08-13', '2020-08-13')).toEqual({
            justOneDate: true,
            fromFormatted: '13.8.2020',
            toFormatted: '13.8.2020',
        })
    })

    test('date range', () => {
        expect(formatTimeRange('2020-08-13', '2020-08-15')).toEqual({
            justOneDate: false,
            fromFormatted: '13.8.2020',
            toFormatted: '15.8.2020',
        })
    })

    test('both times', () => {
        expect(formatTimeRange('2020-08-13 08:00:00', '2020-08-13 15:00:00')).toEqual({
            justOneDate: false,
            fromFormatted: '13.8.2020 08:00',
            toFormatted: '13.8.2020 15:00',
        })
    })

    test('on date has time', () => {
        expect(formatTimeRange('2020-08-13', '2020-08-13 15:00:00')).toEqual({
            justOneDate: false,
            fromFormatted: '13.8.2020 00:00',
            toFormatted: '13.8.2020 15:00',
        })
    })
})
