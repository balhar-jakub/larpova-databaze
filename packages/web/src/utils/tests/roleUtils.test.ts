/**
 * The role helpers: admin checks and the label-id list parsing that the
 * URL query layer relies on.
 */
import { UserRole } from 'src/graphql/__generated__/typescript-operations'
import { getLabelIds, isAdmin, isAtLeastEditor } from '../roleUtils'

describe('isAdmin', () => {
    it('is true only for admins', () => {
        expect(isAdmin(UserRole.Admin)).toBe(true)
        expect(isAdmin(UserRole.Editor)).toBe(false)
        expect(isAdmin(UserRole.User)).toBe(false)
        expect(isAdmin(undefined)).toBe(false)
    })
})

describe('isAtLeastEditor', () => {
    it('accepts editors and admins, rejects plain users and visitors', () => {
        expect(isAtLeastEditor(UserRole.Editor)).toBe(true)
        expect(isAtLeastEditor(UserRole.Admin)).toBe(true)
        expect(isAtLeastEditor(UserRole.User)).toBe(false)
        expect(isAtLeastEditor(undefined)).toBe(false)
    })
})

describe('getLabelIds', () => {
    it('passes an array through', () => {
        expect(getLabelIds(['l1', 'l2'])).toEqual(['l1', 'l2'])
    })

    it('splits a comma-separated string', () => {
        expect(getLabelIds('l1,l2,l3')).toEqual(['l1', 'l2', 'l3'])
    })

    it('returns undefined for empty input', () => {
        expect(getLabelIds(undefined)).toBeUndefined()
    })
})
