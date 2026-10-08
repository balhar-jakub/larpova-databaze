import React from 'react'
import { Gender, UserRole } from '../../graphql/__generated__/typescript-operations'

export interface UserContextValue {
    readonly id?: string
    readonly imageId?: string
    readonly name?: string
    readonly nickName?: string
    readonly role?: UserRole
    /** Grammatical gender the wording uses (`Hrál jsem` / `Hrála jsem`). */
    readonly gender?: Gender
}

export interface UserContextShape {
    readonly value?: UserContextValue
    readonly actions: {
        reload: () => void
    }
}

export const UserContext = React.createContext<UserContextShape | undefined>(undefined)
