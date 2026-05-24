import { HttpService, LOCAL_API_BASE, LOG_URL } from './HttpService'

/**
 * Mock fetch.
 */
const mockFetch = jest.fn()
jest.mock('isomorphic-unfetch', () => (url: string, init: RequestInit) => {
    // Register call in mock (when we try to return mock directly, it does not work)
    mockFetch(url, init)

    // Fail when requested
    if (init.body?.toString().includes('fail')) {
        return Promise.reject(new Error('Connection failed'))
    }

    return Promise.resolve({ json: () => Promise.resolve({}) })
})

describe('HttpService', () => {
    const errorSpy = jest.spyOn(console, 'error')

    beforeEach(() => {
        jest.resetAllMocks()
    })

    describe('post', () => {
        test('success call to proxy/items', async () => {
            const response = await HttpService.post('items', { category: 2 })

            expect(response).toBeDefined()

            expect(mockFetch).toHaveBeenCalledTimes(1)
            expect(mockFetch).toHaveBeenCalledWith('http://localhost/proxy/items', {
                body: '{"category":2}',
                headers: expect.any(Headers),
                method: 'POST',
            })
        })

        test('success call to api/logs', async () => {
            const response = await HttpService.post(LOG_URL, { message: 'Message' }, LOCAL_API_BASE)

            expect(response).toBeDefined()

            expect(response).toBeDefined()

            expect(mockFetch).toHaveBeenCalledTimes(1)
            expect(mockFetch).toHaveBeenCalledWith('http://localhost/api/log', {
                body: '{"message":"Message"}',
                headers: expect.any(Headers),
                method: 'POST',
            })
        })

        test('fail for proxy/items', async () => {
            const response = await HttpService.post('items', { category: 2, fail: true })

            expect(response).not.toBeDefined()

            expect(mockFetch).toHaveBeenCalledTimes(2)

            expect(mockFetch).toHaveBeenCalledWith('http://localhost/proxy/items', {
                body: '{"category":2,"fail":true}',
                headers: expect.any(Headers),
                method: 'POST',
            })

            // Check error has been logged
            expect(errorSpy).toHaveBeenCalled()
            expect(mockFetch).toHaveBeenCalledWith('http://localhost/api/log', {
                body:
                    '{"severity":"error","message":"POST to http://localhost/proxy/items failed","data":{"error":{}}}',
                method: 'POST',
            })
        })

        test('fail for api/log', async () => {
            const response = await HttpService.post(LOG_URL, { message: 'Message', fail: true }, LOCAL_API_BASE)

            expect(response).not.toBeDefined()

            // Should not fire log request when log failed
            expect(mockFetch).toHaveBeenCalledTimes(1)

            expect(mockFetch).toHaveBeenCalledWith('http://localhost/api/log', {
                body: '{"message":"Message","fail":true}',
                headers: expect.any(Headers),
                method: 'POST',
            })

            // Check error has been logged
            expect(errorSpy).toHaveBeenCalled()
        })
    })

    describe('get', () => {
        test('success call to proxy/items', async () => {
            const response = await HttpService.get('items')

            expect(response).toBeDefined()

            expect(mockFetch).toHaveBeenCalledTimes(1)
            expect(mockFetch).toHaveBeenCalledWith('http://localhost/proxy/items', {
                method: 'GET',
            })
        })
    })
})
