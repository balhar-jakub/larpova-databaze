import { useEffect } from 'react'

/**
 * Remove server-side generated CSS once page was loaded so that we don't have duplicate styles.
 * Use once in every page.
 */
export const useRemoveServerSideCss = () => {
    useEffect(() => {
        const jssSsr = document.getElementById('jss-ssr')
        if (jssSsr) {
            jssSsr.parentElement?.removeChild(jssSsr)
        }
    }, [])
}
