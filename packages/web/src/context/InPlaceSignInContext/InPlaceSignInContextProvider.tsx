import React, { useMemo, useState } from 'react'
import { InPlaceSignInContext } from 'src/context/InPlaceSignInContext/InPlaceSignInContext'

export const InPlaceSignInContextProvider: React.FC = ({ children }) => {
    const [value, setValue] = useState(false)
    const contextValue = useMemo(
        () => ({
            value,
            setValue,
        }),
        [value, setValue],
    )

    return <InPlaceSignInContext.Provider value={contextValue}>{children}</InPlaceSignInContext.Provider>
}
