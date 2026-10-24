/**
 * @jest-environment jsdom
 */
/**
 * The label mapper's null arms: a label row straight from GraphQL may carry
 * no name and no description, and the form state must receive '' and
 * undefined — never null leaking into a controlled input.
 */
import { jest } from '@jest/globals'

// The hook module imports useQuery/isInBrowser at load time; the config's
// stub for @apollo/client has no named export, so give it one.
jest.unstable_mockModule('@apollo/client', () => ({ useQuery: () => ({ data: undefined, loading: false }) }))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))

const { labelMapper } = await import('../usePredefinedLabels')

describe('labelMapper', () => {
    it('maps a complete label as-is', () => {
        expect(labelMapper({ id: '1', name: 'komorní', description: 'malé hráčské pásmo' })).toEqual({
            id: '1',
            name: 'komorní',
            description: 'malé hráčské pásmo',
        })
    })

    it('a null name becomes the empty string', () => {
        expect(labelMapper({ id: '2', name: null, description: 'x' })).toEqual({
            id: '2',
            name: '',
            description: 'x',
        })
    })

    it('a null description becomes undefined (not null)', () => {
        const mapped = labelMapper({ id: '3', name: 'horor', description: null })
        expect(mapped.description).toBeUndefined()
        expect('description' in mapped).toBe(true)
    })

    it('a label with neither name nor description survives whole', () => {
        expect(labelMapper({ id: '4', name: null, description: null })).toEqual({
            id: '4',
            name: '',
            description: undefined,
        })
    })
})
