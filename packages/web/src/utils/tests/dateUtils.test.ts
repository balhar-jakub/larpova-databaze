import { formatTimeRange, hasTimePart, parseDateTime } from '../dateUtils'

describe('parseDateTime', () => {
    test('parse undefined', () => {
        expect(parseDateTime()).toBeUndefined()
    })

    test('parse date returns Date with correct year/month/day', () => {
        const result = parseDateTime('2020-11-15')
        expect(result).toBeInstanceOf(Date)
        expect(result!.getUTCFullYear()).toBe(2020)
        expect(result!.getUTCMonth()).toBe(10) // 0-indexed
        expect(result!.getUTCDate()).toBe(15)
    })

    test('parse date with time', () => {
        const result = parseDateTime('2020-11-13 23:00:00')
        expect(result).toBeInstanceOf(Date)
        expect(result!.getUTCHours()).toBe(22) // CET = UTC+1 → 23:00 CET = 22:00 UTC
    })

    test('parse date with time in DST', () => {
        const result = parseDateTime('2020-07-10 05:00:00')
        expect(result).toBeInstanceOf(Date)
        // CEST = UTC+2 → 05:00 CEST = 03:00 UTC
        expect(result!.getUTCHours()).toBe(3)
    })
})

describe('hasTimePart', () => {
    it('should return false for undefined', () => {
        expect(hasTimePart()).toBeFalsy()
    })

    it('should return true for date at 2AM', () => {
        expect(hasTimePart(new Date(2020, 7, 13, 2, 0, 0))).toBeTruthy()
    })

    it('should return false for date at midnight', () => {
        expect(hasTimePart(new Date(2020, 7, 13, 0, 0, 0))).toBeFalsy()
    })

    it('should return false for date at midnight (0 minutes)', () => {
        expect(hasTimePart(new Date(2020, 11, 13, 0, 0, 0))).toBeFalsy()
    })
})

describe('formatTimeRange', () => {
    test('empty input', () => {
        expect(formatTimeRange()).toMatchObject({
            justOneDate: true,
        })
    })

    test('same day', () => {
        const result = formatTimeRange('2020-08-13', '2020-08-13')
        expect(result.justOneDate).toBe(true)
        expect(result.fromFormatted).toMatch(/^13\.8\.2020/)
        expect(result.toFormatted).toMatch(/^13\.8\.2020/)
    })

    test('date range', () => {
        const result = formatTimeRange('2020-08-13', '2020-08-15')
        expect(result.justOneDate).toBe(false)
        expect(result.fromFormatted).toMatch(/^13\.8\.2020/)
        expect(result.toFormatted).toMatch(/^15\.8\.2020/)
    })

    test('both times', () => {
        const result = formatTimeRange('2020-08-13 08:00:00', '2020-08-13 15:00:00')
        expect(result.justOneDate).toBe(false)
        expect(result.fromFormatted).toMatch(/13\.8\.2020/)
        expect(result.toFormatted).toMatch(/13\.8\.2020/)
    })

    test('on date has time', () => {
        const result = formatTimeRange('2020-08-13', '2020-08-13 15:00:00')
        expect(result.justOneDate).toBe(false)
        expect(result.fromFormatted).toMatch(/13\.8\.2020/)
        expect(result.toFormatted).toMatch(/13\.8\.2020/)
    })
})
