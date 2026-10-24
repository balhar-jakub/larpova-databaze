import { validateDate, validateTime , validateRequiredArray, validateRequired, validateEmail, validatePositiveInteger, fieldValidator, validateWithValidators } from '../validationUtils'

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

describe('validateRequiredArray', () => {
    it('requires a non-empty array', () => {
        expect(validateRequiredArray(['a'])).toBeUndefined()
        expect(validateRequiredArray(undefined)).toBe('Errors.required')
        expect(validateRequiredArray([])).toBe('Errors.required')
    })
})

describe('validateEmail', () => {
    it('accepts valid emails and empty input', () => {
        expect(validateEmail('jakub@balhar.net')).toBeUndefined()
        expect(validateEmail(undefined)).toBeUndefined()
        expect(validateEmail('not-an-email')).toBe('Errors.emailRequired')
    })
})

describe('validatePositiveInteger', () => {
    it('accepts positive integers and rejects the rest', () => {
        expect(validatePositiveInteger('42')).toBeUndefined()
        expect(validatePositiveInteger(undefined)).toBeUndefined()
        // The regex is non-negative integers: no sign, no decimals.
        expect(validatePositiveInteger('0')).toBeUndefined()
        expect(validatePositiveInteger('-3')).toBe('Errors.integerRequired')
        expect(validatePositiveInteger('4.5')).toBe('Errors.integerRequired')
    })
})

describe('fieldValidator', () => {
    const t = (key: string) => `translated:${key}`

    it('runs a single validator and translates its error', () => {
        expect(fieldValidator(t, validateRequired)('')).toBe('translated:Errors.required')
        expect(fieldValidator(t, validateRequired)('x')).toBeUndefined()
    })

    it('runs a list of validators until one fails', () => {
        const list = [validateRequired, validateEmail]
        expect(fieldValidator(t, list)('')).toBe('translated:Errors.required')
        expect(fieldValidator(t, list)('bad')).toBe('translated:Errors.emailRequired')
        expect(fieldValidator(t, list)('jakub@balhar.net')).toBeUndefined()
    })
})

describe('validateWithValidators', () => {
    const t = (key: string) => `translated:${key}`

    it('collects the errors of the mapped validators', () => {
        const result = validateWithValidators(
            { name: '', email: 'nope', note: 7 },
            {
                name: validateRequired,
                email: validateEmail,
            },
            t,
        )
        expect(result.name).toBe('translated:Errors.required')
        expect(result.email).toBe('translated:Errors.emailRequired')
    })
})
