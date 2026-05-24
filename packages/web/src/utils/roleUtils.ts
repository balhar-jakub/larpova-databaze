import { UserRole } from '../graphql/__generated__/typescript-operations'

export const isAdmin = (role?: UserRole) => role === UserRole.Admin

export const isAtLeastEditor = (role?: UserRole) => role === UserRole.Editor || role === UserRole.Admin

export const getLabelIds = (labelIds?: string | string[]) => {
    if (!labelIds) {
        return undefined
    }

    if (Array.isArray(labelIds)) {
        return labelIds
    }

    return labelIds.split(',')
}
