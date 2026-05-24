import { act, renderHook } from '@testing-library/react-hooks'
import { useBreakpoint } from '../useBreakpoint'

describe('useBreakpoint', () => {
    const matchMediaMock = jest.fn()
    window.matchMedia = matchMediaMock
    let eventListener: ((event: MediaQueryListEvent) => void) | null = null
    const addEventListener = (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
            eventListener = listener
        }
    }
    const removeEventListener = jest.fn()

    test('resolving to small breakpoint', () => {
        matchMediaMock.mockReturnValueOnce({ matches: false, addEventListener, removeEventListener } as any)
        const hook = renderHook(useBreakpoint)

        expect(hook.result.current).toBe('sm')
    })

    beforeEach(jest.resetAllMocks)

    test('changing from medium to small breakpoint', () => {
        matchMediaMock.mockReturnValueOnce({ matches: true, addEventListener, removeEventListener } as any)
        const hook = renderHook(useBreakpoint)

        expect(hook.result.current).toBe('md')
        expect(eventListener).not.toBeNull()

        act(() => eventListener?.({ matches: false } as any))
        expect(hook.result.current).toBe('sm')
    })

    it('should remove event on unmount', () => {
        matchMediaMock.mockReturnValueOnce({ matches: true, addEventListener, removeEventListener } as any)
        const hook = renderHook(useBreakpoint)

        hook.unmount()
        expect(removeEventListener).toHaveBeenCalledWith('change', eventListener)
    })
})
