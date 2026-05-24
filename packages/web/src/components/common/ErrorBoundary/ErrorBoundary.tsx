import * as React from 'react'

import { LoggingService } from 'src/api/services/LoggingService'

/**
 * Catches all unhandled errors in the application and logs them to the server
 */
export class ErrorBoundary extends React.PureComponent<{}> {
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        LoggingService.logError(error.toString(), { stack: error.stack, errorInfo })
    }

    render() {
        const { children } = this.props

        return children
    }
}
