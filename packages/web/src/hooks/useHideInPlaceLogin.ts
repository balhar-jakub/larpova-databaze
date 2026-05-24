import { useCallback, useContext } from 'react'
import { InPlaceSignInContext } from '../context/InPlaceSignInContext/InPlaceSignInContext'

/**
 * Provide callback to hide in-place login
 */
export const useHideInPlaceLogin = () => {
    const signInContext = useContext(InPlaceSignInContext)
    const cb = useCallback(() => signInContext.setValue(false), [signInContext])

    return cb
}
