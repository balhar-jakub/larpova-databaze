import React from 'react'
import { UserRole } from '../../graphql/__generated__/typescript-operations'

export interface UserContextValue {
    readonly id?: string
    readonly imageId?: string
    readonly name?: string
    readonly nickName?: string
    readonly role?: UserRole
}

export interface UserContextShape {
    readonly value?: UserContextValue
    readonly actions: {
        reload: () => void
    }
}

export const UserContext = React.createContext<UserContextShape | undefined>(undefined)
