export const GA_TRACKING_ID: string = process.env.NEXT_PUBLIC_GA_TRACKING_ID || ''

/**
 * Google Analytics is only wired when a measurement id was present at build time
 * (`NEXT_PUBLIC_GA_TRACKING_ID`, inlined by Next.js) and this is a production build.
 * Without an id the gtag script used to load as `gtag/js?id=` and every call was a
 * silent no-op — which is how the site shipped with analytics effectively off.
 */
export const GA_ENABLED: boolean = GA_TRACKING_ID.length > 0 && process.env.NODE_ENV === 'production'

/** localStorage key holding the visitor's analytics decision ('granted' | 'denied'). */
export const GA_CONSENT_KEY = 'csld-ga-consent'

const isBrowser = () => typeof window !== 'undefined'

const gtag = (): ((...args: unknown[]) => void) | undefined => {
    if (!isBrowser()) return undefined
    const w = window as unknown as { gtag?: (...args: unknown[]) => void }
    return typeof w.gtag === 'function' ? w.gtag : undefined
}

/**
 * Google Consent Mode. Without a stored decision analytics cookies stay denied and
 * gtag sends cookieless pings only; the banner calls this with `true` to upgrade.
 */
export const updateGTagConsent = (granted: boolean) => {
    if (!GA_ENABLED) return
    const g = gtag()
    if (!g) return
    const state = granted ? 'granted' : 'denied'
    g('consent', 'update', {
        ad_storage: state,
        ad_user_data: state,
        ad_personalization: state,
        analytics_storage: state,
    })
}

export const readGTagConsent = (): boolean => {
    if (!isBrowser()) return false
    try {
        return window.localStorage.getItem(GA_CONSENT_KEY) === 'granted'
    } catch (err) {
        return false
    }
}

export const hasGTagDecision = (): boolean => {
    if (!isBrowser()) return false
    try {
        const stored = window.localStorage.getItem(GA_CONSENT_KEY)
        return stored === 'granted' || stored === 'denied'
    } catch (err) {
        return false
    }
}

export const storeGTagConsent = (granted: boolean) => {
    if (!isBrowser()) return
    try {
        window.localStorage.setItem(GA_CONSENT_KEY, granted ? 'granted' : 'denied')
    } catch (err) {
        // private mode / storage disabled — the choice simply does not persist
    }
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
// The initial pageview comes from the `config` call in _document; client-side
// navigations have to send their own page_view event. Next's router passes a
// relative url, while GA4 wants an absolute page_location.
export const registerGTagPageview = (url: string | URL) => {
    if (!GA_ENABLED) return
    const g = gtag()
    if (!g) return
    const location = typeof url === 'string' ? new URL(url, window.location.origin) : url
    g('event', 'page_view', {
        page_location: location.toString(),
        page_path: `${location.pathname}${location.search}`,
    })
}

type GTagEvent = {
    action: string
    category: string
    label: string
    value: number
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const registerGTagEvent = ({ action, category, label, value }: GTagEvent) => {
    if (!GA_ENABLED) return
    const g = gtag()
    if (!g) return
    g('event', action, {
        event_category: category,
        event_label: label,
        value,
    })
}
