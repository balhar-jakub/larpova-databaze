import { NextApiRequest, NextApiResponse } from 'next'

export interface ApiLogRequest {
    readonly severity: 'error' | 'warn' | 'info'
    readonly message: string
    readonly data?: object
}

/**
 * Handles requests to server logs
 */
export default (req: NextApiRequest, res: NextApiResponse) => {
    const payload = req.body

    const message = `[${req.connection.remoteAddress}]: ${payload.message}`
    const { data } = payload

    switch (payload.severity) {
        case 'error':
            // eslint-disable-next-line no-console
            console.error.apply({}, data ? [message, data] : [message])
            break
        case 'warn':
            // eslint-disable-next-line no-console
            console.warn.apply({}, data ? [message, data] : [message])
            break
        default:
            // eslint-disable-next-line no-console
            console.log.apply({}, data ? [message, data] : [message])
    }

    return res.json({})
}
