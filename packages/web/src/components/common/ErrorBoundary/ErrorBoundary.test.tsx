import * as React from 'react'
import { useEffect } from 'react'
import { render } from '@testing-library/react'
import { LoggingService } from 'src/api/services/LoggingService'
import { ErrorBoundary } from './ErrorBoundary'

const ThrowsErrorComponent = () => {
    useEffect(() => {
        throw new Error('Test error')
    })

    return <div>Test</div>
}

describe('ErrorBoundary', () => {
    it('should log error when exception is thrown', () => {
        const logErrorSpy = jest.spyOn(LoggingService, 'logError').mockImplementation(() => {})

        render(
            <ErrorBoundary>
                <ThrowsErrorComponent />
            </ErrorBoundary>,
        )

        expect(logErrorSpy).toHaveBeenCalledWith('Error: Test error', {
            stack: expect.any(String),
            errorInfo: { componentStack: expect.any(String) },
        })
    })
})
