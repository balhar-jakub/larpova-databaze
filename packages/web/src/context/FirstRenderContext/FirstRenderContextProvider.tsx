import React, { useEffect, useState } from 'react'
import { FirstRenderContext } from './FirstRenderContext'

const FirstRenderContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isFirstRender, setIsFirstRender] = useState(true)

    // Clear "first render" flag after first render
    useEffect(() => {
        setIsFirstRender(false)
    }, [])

    return <FirstRenderContext.Provider value={isFirstRender}>{children}</FirstRenderContext.Provider>
}

export default FirstRenderContextProvider
