import * as React from 'react'

export interface ErrorReport {
    readonly severity: 'error'
    readonly message: string
    readonly data: { stack?: string; errorInfo?: React.ErrorInfo }
}

/**
 * Posts an error report to the Next.js API route (pages/api/log.ts),
 * which prints it into the server log. Fire-and-forget: logging must
 * never break the app that is already failing.
 */
export function reportErrorToServer(report: ErrorReport) {
    // eslint-disable-next-line no-console
    void fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
    }).catch((error) => {
        // A failing app should not spawn error loops through its own logger.
        // eslint-disable-next-line no-console
        console.error('reportErrorToServer: /api/log call failed', error)
    })
}

/**
 * Catches all unhandled errors in the application and logs them to the server
 */
export class ErrorBoundary extends React.PureComponent<{ children?: React.ReactNode }> {
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        reportErrorToServer({
            severity: 'error',
            message: error.toString(),
            data: { stack: error.stack, errorInfo },
        })
    }

    render() {
        const { children } = this.props

        return children
    }
}
