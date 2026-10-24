import { useEffect } from 'react'
import { render } from '@testing-library/react'
import { jest } from '@jest/globals'
import { ErrorBoundary } from './ErrorBoundary'

const ThrowsErrorComponent = () => {
    useEffect(() => {
        throw new Error('Test error')
    })

    return <div>Test</div>
}

describe('ErrorBoundary', () => {
    it('should log error when exception is thrown', () => {
        const fetchSpy = jest.fn<(input: unknown, init?: unknown) => Promise<unknown>>()
        fetchSpy.mockResolvedValue({ ok: true })
        const originalFetch = globalThis.fetch
        ;(globalThis as { fetch?: unknown }).fetch = fetchSpy

        try {
            render(
                <ErrorBoundary>
                    <ThrowsErrorComponent />
                </ErrorBoundary>,
            )

            expect(fetchSpy).toHaveBeenCalledTimes(1)
            const [url, init] = fetchSpy.mock.calls[0]
            expect(url).toBe('/api/log')
            expect((init as RequestInit).method).toBe('POST')
            const body = JSON.parse((init as RequestInit).body as string)
            expect(body.severity).toBe('error')
            expect(body.message).toBe('Error: Test error')
            expect(body.data.stack).toEqual(expect.any(String))
            expect(body.data.errorInfo).toEqual({ componentStack: expect.any(String) })
        } finally {
            ;(globalThis as { fetch?: unknown }).fetch = originalFetch
        }
    })

    it('should swallow fetch failures without throwing', async () => {
        const fetchSpy = jest.fn<(input: unknown, init?: unknown) => Promise<unknown>>()
        fetchSpy.mockRejectedValue(new Error('network down'))
        const originalFetch = globalThis.fetch
        ;(globalThis as { fetch?: unknown }).fetch = fetchSpy
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        try {
            render(
                <ErrorBoundary>
                    <ThrowsErrorComponent />
                </ErrorBoundary>,
            )

            // Fire-and-forget: give the rejection handler a tick to run.
            await Promise.resolve()
            await Promise.resolve()

            expect(errorSpy).toHaveBeenCalled()
        } finally {
            ;(globalThis as { fetch?: unknown }).fetch = originalFetch
            jest.restoreAllMocks()
        }
    })
})
