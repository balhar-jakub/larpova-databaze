import { validateDate, validateTime } from '../validationUtils'

describe('validateDate', () => {
    it('should pass undefined date as valid', () => {
        expect(validateDate(undefined)).toBeUndefined()
    })

    it('should pass empty date as valid date', () => {
        expect(validateDate('')).toBeUndefined()
    })

    it('should reject date with invalid format', () => {
        expect(validateDate('kdkdqk')).toBe('Errors.invalidDate')
    })

    it('should reject date with nonsense month', () => {
        expect(validateDate('1.270.1970')).toBe('Errors.invalidDate')
    })

    it('should reject date with nonsense day', () => {
        expect(validateDate('0.12.1970')).toBe('Errors.invalidDate')
    })

    it('should reject date with day that is not in the month', () => {
        expect(validateDate('31.4.1970')).toBe('Errors.invalidDate')
    })

    it('should reject date with day that is not in the leap year', () => {
        expect(validateDate('29.2.2021')).toBe('Errors.invalidDate')
    })

    it('should reject date with spaces', () => {
        expect(validateDate('12 2 2021')).toBe('Errors.invalidDate')
    })

    it('should pass correct date', () => {
        expect(validateDate('28.2.2021')).toBeUndefined()
    })
})

describe('validateTime', () => {
    it('should return OK on undefined input', () => {
        expect(validateTime()).toBeUndefined()
    })

    it('should return OK on empty input', () => {
        expect(validateTime()).toBeUndefined()
    })

    it('should return invalidTimeFormat on invalid format', () => {
        expect(validateTime('dklqdqw')).toBe('Errors.invalidTimeFormat')
    })

    it('should return invalidTimeFormat on negative numbers format', () => {
        expect(validateTime('00:-01')).toBe('Errors.invalidTimeFormat')
    })

    it('should return invalidTime when hour is too high', () => {
        expect(validateTime('24:01')).toBe('Errors.invalidTime')
    })

    it('should return invalidTime when minute is too high', () => {
        expect(validateTime('02:60')).toBe('Errors.invalidTime')
    })

    it('should return undefined when time is 23:59', () => {
        expect(validateTime('23:59')).toBeUndefined()
    })

    it('should return undefined when time is 00:00', () => {
        expect(validateTime('00:00')).toBeUndefined()
    })
})
