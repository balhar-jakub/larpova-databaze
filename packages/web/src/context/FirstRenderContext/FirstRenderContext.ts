import React from 'react'

// Provides value whether we are in first render (SSR or hydrating render) or not
export const FirstRenderContext = React.createContext<boolean>(true)
