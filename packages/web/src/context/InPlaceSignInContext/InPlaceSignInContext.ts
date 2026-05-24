import React from 'react'

export interface InPlaceSignInContextShape {
    readonly value: boolean
    readonly setValue: (newValue: boolean) => void
}

const defaultValue: InPlaceSignInContextShape = {
    value: false,
    setValue: () => {},
}

export const InPlaceSignInContext = React.createContext<InPlaceSignInContextShape>(defaultValue)
