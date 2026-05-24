export const GA_TRACKING_ID: string = process.env.NEXT_PUBLIC_GA_TRACKING_ID || ''
const isInProduction = process.env.NODE_ENV === 'production'

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const registerGTagPageview = (url: URL) => {
    if (isInProduction) {
        const w = window as any
        w.gtag('config', GA_TRACKING_ID, {
            page_path: url,
        })
    }
}

type GTagEvent = {
    action: string
    category: string
    label: string
    value: number
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const registerGTagEvent = ({ action, category, label, value }: GTagEvent) => {
    if (isInProduction) {
        const w = window as any
        w.gtag('event', action, {
            event_category: category,
            event_label: label,
            value,
        })
    }
}
