import { HttpService, LOG_URL, LOCAL_API_BASE } from 'src/api/services/HttpService'

/**
 * Adapter for logging to server
 */
export const LoggingService = {
    /**
     * Log info message to console and server
     *
     * @param message Message
     * @param data Additional data to be logged
     */
    logInfo: (message: string, data?: object) => {
        // eslint-disable-next-line no-console
        console.log.apply(window, data ? [message, data] : [message])
        HttpService.post(
            LOG_URL,
            {
                severity: 'info',
                message,
                data,
            },
            LOCAL_API_BASE,
        )
    },

    /**
     * Log warning message to console and server
     *
     * @param message Message
     * @param data Additional data to be logged
     */
    logWarning: (message: string, data?: object) => {
        // eslint-disable-next-line no-console
        console.warn.apply(window, data ? [message, data] : [message])
        HttpService.post(
            LOG_URL,
            {
                severity: 'warn',
                message,
                data,
            },
            LOCAL_API_BASE,
        )
    },

    /**
     * Log error message to console and server
     *
     * @param message Message
     * @param data Additional data to be logged
     */
    logError: (message: string, data?: object) => {
        // eslint-disable-next-line no-console
        console.error.apply(window, data ? [message, data] : [message])
        HttpService.post(
            LOG_URL,
            {
                severity: 'error',
                message,
                data,
            },
            LOCAL_API_BASE,
        )
    },
}
