import logHandler, { ApiLogRequest } from '../log'

const mockResponse = {
    json: jest.fn(),
} as any

describe('Log handler tests', () => {
    const logSpy = jest.spyOn(console, 'log')
    const errorSpy = jest.spyOn(console, 'error')
    const warnSpy = jest.spyOn(console, 'warn')

    beforeEach(jest.resetAllMocks)
    const remoteAddress = '1.2.3.4'
    const connection = { remoteAddress }

    test('Handling error', () => {
        const message = 'Error'
        const data = {
            stack: [1, 2, 3],
        }

        logHandler(
            {
                body: {
                    severity: 'error',
                    message,
                    data,
                } as ApiLogRequest,
                connection,
            } as any,
            mockResponse,
        )

        expect(errorSpy).toHaveBeenCalledWith(`[${remoteAddress}]: ${message}`, data)
        expect(mockResponse.json).toHaveBeenCalled()
    })

    test('Handling warning', () => {
        const message = 'Warning'

        logHandler(
            {
                body: {
                    severity: 'warn',
                    message,
                } as ApiLogRequest,
                connection,
            } as any,
            mockResponse,
        )

        expect(warnSpy).toHaveBeenCalledWith(`[${remoteAddress}]: ${message}`)
        expect(mockResponse.json).toHaveBeenCalled()
    })

    test('Handling simple log', () => {
        const message = 'Some logging message'

        logHandler(
            {
                body: {
                    severity: 'info',
                    message,
                } as ApiLogRequest,
                connection,
            } as any,
            mockResponse,
        )

        expect(logSpy).toHaveBeenCalledWith(`[${remoteAddress}]: ${message}`)
        expect(mockResponse.json).toHaveBeenCalled()
    })
})
