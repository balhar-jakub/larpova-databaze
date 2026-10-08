import { Gender } from '../graphql/__generated__/typescript-operations'

/**
 * The grammatical gender of the person a piece of wording is about. `other`
 * covers both an anonymous visitor and a signed-in user who did not state a
 * gender — both read the neutral form (`Hrál/a jsem`).
 */
export type GenderContext = 'male' | 'female' | 'other'

export function genderContext(gender?: Gender | null): GenderContext {
    if (gender === Gender.Male) return 'male'
    if (gender === Gender.Female) return 'female'
    return 'other'
}
