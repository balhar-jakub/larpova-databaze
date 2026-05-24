import { HttpService, LOG_URL, LOCAL_API_BASE } from './HttpService'
import { LoggingService } from './LoggingService'

describe('LoggingAdapter', () => {
    const logSpy = jest.spyOn(console, 'log')
    const warnSpy = jest.spyOn(console, 'warn')
    const errorSpy = jest.spyOn(console, 'error')
    const postSpy = jest.spyOn(HttpService, 'post')

    beforeEach(jest.resetAllMocks)

    test('logInfo', () => {
        const message = 'Test message'
        const data = { hello: 'world' }
        LoggingService.logInfo(message, data)

        expect(logSpy).toHaveBeenCalledWith(message, data)
        expect(postSpy).toHaveBeenCalledWith(LOG_URL, { message, data, severity: 'info' }, LOCAL_API_BASE)
    })

    test('logError', () => {
        const message = 'Test error'
        const data = undefined
        LoggingService.logError(message, data)

        expect(errorSpy).toHaveBeenCalledWith(message)
        expect(postSpy).toHaveBeenCalledWith(LOG_URL, { message, data, severity: 'error' }, LOCAL_API_BASE)
    })

    test('logInfo', () => {
        const message = 'Test message'
        const data = undefined
        LoggingService.logWarning(message, data)

        expect(warnSpy).toHaveBeenCalledWith(message)
        expect(postSpy).toHaveBeenCalledWith(LOG_URL, { message, data, severity: 'warn' }, LOCAL_API_BASE)
    })
})
