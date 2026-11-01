/**
 * @jest-environment jsdom
 */
/**
 * The GA4 event helper. registerGTagEvent forwards to window.gtag as an
 * 'event' call only when GA was enabled at build time (a tracking id was
 * inlined AND NODE_ENV is production); with GA off — or no gtag function on
 * window — it is a silent no-op, so callers never gate themselves.
 */
import { jest } from '@jest/globals'

/**
 * GA_ENABLED is computed at module load from the env, so each scenario
 * re-imports a fresh copy of the module with the env set accordingly.
 */
const importGtag = async (trackingId: string | undefined, nodeEnv: string) => {
    jest.resetModules()
    const env = process.env as Record<string, string | undefined>
    const prevTracking = env.NEXT_PUBLIC_GA_TRACKING_ID
    const prevEnv = env.NODE_ENV
    if (trackingId === undefined) delete env.NEXT_PUBLIC_GA_TRACKING_ID
    else env.NEXT_PUBLIC_GA_TRACKING_ID = trackingId
    env.NODE_ENV = nodeEnv
    try {
        return await import('../gtag.js')
    } finally {
        if (prevTracking === undefined) delete env.NEXT_PUBLIC_GA_TRACKING_ID
        else env.NEXT_PUBLIC_GA_TRACKING_ID = prevTracking
        env.NODE_ENV = prevEnv
    }
}

type GtagFn = ReturnType<typeof jest.fn>
let gtagMock: GtagFn

beforeEach(() => {
    gtagMock = jest.fn()
    ;(window as unknown as { gtag?: GtagFn }).gtag = gtagMock
})

afterEach(() => {
    delete (window as unknown as { gtag?: GtagFn }).gtag
})

describe('registerGTagEvent', () => {
    it('calls gtag("event", action, …) with category, label and value when GA is enabled', async () => {
        const gtag = await importGtag('G-TESTID123', 'production')
        expect(gtag.GA_ENABLED).toBe(true)

        gtag.registerGTagEvent({ action: 'game_added', category: 'contribution', label: 'Nová hra', value: 1 })

        expect(gtagMock).toHaveBeenCalledTimes(1)
        expect(gtagMock).toHaveBeenCalledWith('event', 'game_added', {
            event_category: 'contribution',
            event_label: 'Nová hra',
            value: 1,
        })
    })

    it('is a no-op when no tracking id was inlined at build time', async () => {
        const gtag = await importGtag(undefined, 'production')
        expect(gtag.GA_ENABLED).toBe(false)

        gtag.registerGTagEvent({ action: 'rating_added', category: 'contribution', label: '42', value: 10 })

        expect(gtagMock).not.toHaveBeenCalled()
    })

    it('is a no-op outside production even with a tracking id', async () => {
        const gtag = await importGtag('G-TESTID123', 'development')
        expect(gtag.GA_ENABLED).toBe(false)

        gtag.registerGTagEvent({ action: 'search_executed', category: 'engagement', label: 'larp', value: 1 })

        expect(gtagMock).not.toHaveBeenCalled()
    })

    it('is a no-op when window.gtag is not installed, without throwing', async () => {
        delete (window as unknown as { gtag?: GtagFn }).gtag
        const gtag = await importGtag('G-TESTID123', 'production')

        expect(() =>
            gtag.registerGTagEvent({ action: 'game_added', category: 'contribution', label: 'x', value: 1 }),
        ).not.toThrow()
        expect(gtagMock).not.toHaveBeenCalled()
    })
})
