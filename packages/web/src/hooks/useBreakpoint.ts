import { useCallback, useEffect, useState } from 'react'

/**
 * Recognized breakpoints
 */
export type Breakpoint = 'sm' | 'md'

/**
 * Manage current breakpoint. It uses listeners on matcher, so value is stored into breakpointContext and children
 * should use value from context so that it is consistent throughout the app.
 *
 * @return Current breakpoint.
 */
export const useBreakpoint = (): Breakpoint => {
    // We cannot calculate breakpoint right away since this runs on server for the first time, so we set default and
    // it will be calculated in useEffect()
    const [breakpoint, setBreakpoint] = useState<Breakpoint>('md')

    const resizeHandler = useCallback(({ matches }: { matches: boolean }) => {
        setBreakpoint(matches ? 'md' : 'sm')
    }, [])

    useEffect(() => {
        // Create matched and add listener
        const matcher = window.matchMedia('(min-width: 970px)')
        resizeHandler({ matches: matcher.matches })
        matcher.addEventListener<'change'>('change', resizeHandler)

        return () => matcher.removeEventListener('change', resizeHandler)
    }, [resizeHandler])

    return breakpoint
}
