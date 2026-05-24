import fetch from 'isomorphic-unfetch'

// It is defined here so that we can log http errors without introducing circular dependency between HttpService and LoggingAdapter
export const LOG_URL = 'log'

const DEFAULT_API_BASE = 'proxy'

/**
 * API base to use when we want to get to our local API (for logging)
 */
export const LOCAL_API_BASE = 'api'

/**
 * HTTP calling utility
 *
 * @param url URL to call
 * @param init URL parameters (see fetch docs)
 * @param apiBase Which API to use (LOCAL_API_BASE / undefined (DEFAULT_API_BASE))
 */
const callHttp = (url: string, init: RequestInit, apiBase: string = DEFAULT_API_BASE) => {
    const completeUrl = `${window.location.origin}/${apiBase}/${url}`
    return fetch(completeUrl, init).catch(error => {
        const message = `${init.method} to ${completeUrl} failed`

        // eslint-disable-next-line no-console
        console.error(message, error)

        if (url !== LOG_URL) {
            // Do not try to log to server errors when logging to server to avoid endless loops

            // A bit of copy-paste, but we don't want to introduce circular dependency between HttpService and LoggingAdapter
            callHttp(
                LOG_URL,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        severity: 'error',
                        message: `${init.method} to ${completeUrl} failed`,
                        data: { error },
                    }),
                },
                LOCAL_API_BASE,
            )
        }
    })
}

/**
 * HTTP requests service
 */
export const HttpService = {
    /**
     * Execute HTTP post
     *
     * @param url URL to post to (relative to API base, without leading slash)
     * @param body Request body. Either direct string, or object that will be JSON.stringified
     * @param apiBase API base to use (default is proxy to REST server)
     */
    post: (url: string, body: object | string, apiBase?: string) => {
        const headers = new Headers()
        headers.append('Content-Type', 'application/json')

        return callHttp(
            url,
            {
                headers,
                body: typeof body === 'string' ? body : JSON.stringify(body),
                method: 'POST',
            },
            apiBase,
        )
    },

    /**
     * Execute HTTP get
     *
     * @param url URL to get from (relative to API base, without leading slash)
     * @param apiBase API base to use (default is proxy to REST server)
     */
    get: (url: string, apiBase?: string) => callHttp(url, { method: 'GET' }, apiBase),
}
