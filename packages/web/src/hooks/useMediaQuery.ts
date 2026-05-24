import { useEffect, useState } from 'react'
import { breakPoints } from '../theme/breakPoints'

/**
 * Watch for media query
 *
 * @param mediaQuery CSS media query to watch
 *
 * @return true = media query matches, false = media query does not match, undefined = not yet decided (on first render).
 */
export const useMediaQuery = (mediaQuery: string) => {
    const [matches, setMatches] = useState<boolean | undefined>()

    useEffect(() => {
        /* Run after first render => not on server */
        const matcher = window.matchMedia(mediaQuery)

        // Store current value
        setMatches(matcher.matches)

        // Start listening
        const listener = (e: MediaQueryListEvent) => {
            setMatches(e.matches)
        }
        matcher.addEventListener('change', listener)

        return () => matcher.removeEventListener('change', listener)
    }, [mediaQuery, setMatches])

    return matches
}

export const useIsMdOrLarger = () => useMediaQuery(`(min-width: ${breakPoints.md}px)`)

export const useIsLgOrLarger = () => useMediaQuery(`(min-width: ${breakPoints.lg}px)`)
