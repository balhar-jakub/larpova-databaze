import { useEffect, useRef } from 'react'

/**
 * Since dialog shows by animation, inputs are not visible initially and so classic autoFocus attribute does not work.
 * This hook circumvents it by focusing some 100ms after component is rendered (you must place it to render in the same render form is shown).
 *
 * @param name Name of input element to focus
 *
 * @return Ref to place at some element around the form / desired input
 */
export const useFocusInput = <T extends Element>(name: string) => {
    const wrapperRef = useRef<T | null>(null)
    const timerRef = useRef(0)
    const retryCountRef = useRef(0)

    // Since inside of the form could be lazy-loaded, we retry several times until we are successful or tries run out
    useEffect(() => {
        timerRef.current = window.setInterval(() => {
            if (wrapperRef.current) {
                const element = wrapperRef.current.getElementsByTagName('input').namedItem(name)
                if (element) {
                    clearInterval(timerRef.current)
                    element.focus()
                    return
                }
            }

            // Check if we ran out of retries
            retryCountRef.current -= 1
            if (retryCountRef.current <= 0) {
                window.clearInterval(timerRef.current)
                timerRef.current = 0
            }
        }, 200)
        retryCountRef.current = 50

        // Clear timeout on effect suspension
        return () => window.clearInterval(timerRef.current)
    }, [wrapperRef, timerRef, retryCountRef, name])

    return wrapperRef
}
