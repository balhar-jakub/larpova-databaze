import { Gender } from '../../graphql/__generated__/typescript-operations'
import { genderContext } from '../genderUtils'

describe('genderContext', () => {
    test('maps the GraphQL enum to the i18n context', () => {
        expect(genderContext(Gender.Male)).toBe('male')
        expect(genderContext(Gender.Female)).toBe('female')
    })

    test('an anonymous visitor and an unstated gender share the neutral context', () => {
        expect(genderContext(Gender.Unspecified)).toBe('other')
        expect(genderContext(undefined)).toBe('other')
        expect(genderContext(null)).toBe('other')
    })
})
