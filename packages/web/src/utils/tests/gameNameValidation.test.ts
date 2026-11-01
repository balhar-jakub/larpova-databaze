import { validateGameNameField } from '../validationUtils'
import {
    validateGameName,
    MIN_GAME_NAME_LENGTH,
    BUTTON_LABEL_GAME_NAMES,
    isButtonLabelGameName,
    normalizeGameName,
} from '../gameNameValidation'

describe('validateGameName (shared client/server rule)', () => {
    it('rejects empty and non-string input as empty', () => {
        expect(validateGameName(undefined)).toBe('empty')
        expect(validateGameName(null)).toBe('empty')
        expect(validateGameName('')).toBe('empty')
        expect(validateGameName('   ')).toBe('empty')
        expect(validateGameName(42)).toBe('empty')
    })

    it('rejects names shorter than the minimum length', () => {
        expect(validateGameName('ab')).toBe('tooShort')
        expect(validateGameName('D8')).toBe('tooShort')
        expect(validateGameName('  ab  ')).toBe('tooShort')
        expect(validateGameName('abc')).toBeNull()
        expect(validateGameName('x'.repeat(MIN_GAME_NAME_LENGTH))).toBeNull()
    })

    it('rejects every known UI button label, case-insensitively and trimmed', () => {
        for (const label of BUTTON_LABEL_GAME_NAMES) {
            expect(validateGameName(label)).toBe('buttonLabel')
            expect(validateGameName(label.toUpperCase())).toBe('buttonLabel')
            expect(validateGameName(`  ${label}  `)).toBe('buttonLabel')
        }
        // The exact string that landed in production four times.
        expect(validateGameName('Uložit změny?')).toBe('buttonLabel')
        expect(validateGameName('Uložit')).toBe('buttonLabel')
        expect(validateGameName('Save')).toBe('buttonLabel')
    })

    it('accepts ordinary game names', () => {
        expect(validateGameName('Nová hra')).toBeNull()
        expect(validateGameName('  Florie 2026  ')).toBeNull()
    })
})

describe('helpers', () => {
    it('normalizeGameName trims strings and treats non-strings as empty', () => {
        expect(normalizeGameName('  Hra  ')).toBe('Hra')
        expect(normalizeGameName(undefined)).toBe('')
        expect(normalizeGameName(7)).toBe('')
    })

    it('isButtonLabelGameName matches trimmed lowercase', () => {
        expect(isButtonLabelGameName(' uložit ')).toBe(true)
        expect(isButtonLabelGameName('Moje hra')).toBe(false)
    })
})

describe('validateGameNameField (form error keys)', () => {
    it('maps each rejection to its Errors key', () => {
        expect(validateGameNameField('')).toBe('Errors.required')
        expect(validateGameNameField('   ')).toBe('Errors.required')
        expect(validateGameNameField(undefined)).toBe('Errors.required')
        expect(validateGameNameField('D8')).toBe('Errors.gameNameTooShort')
        expect(validateGameNameField('Uložit změny?')).toBe('Errors.gameNameButtonLabel')
        expect(validateGameNameField('SAVE')).toBe('Errors.gameNameButtonLabel')
        expect(validateGameNameField('Validní název')).toBeUndefined()
    })
})
