/**
 * Get logged in user from graphql cache (relies on user being loaded by header)
 *
 * @returns Logged in user data, undefined when not logged in, Empty object when loading
 */
import { useContext } from 'react'
import isInBrowser from 'is-in-browser'
import { UserContext } from '../context/UserContext/UserContext'

export const useLoggedInUser = () => {
    const context = useContext(UserContext)
    if (!isInBrowser) {
        // On server pretend we are loading the user so that the result is the same as first render on client
        return {}
    }

    return context ? context.value : {}
}
