/**
 * @jest-environment jsdom
 */
/**
 * The in-place sign-in wrapper: shows the sign-in panel while the
 * context flag is up and the children again once it settles.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

jest.unstable_mockModule('../../../SignIn/SignInPanel', () => ({
    default: ({ onSuccess }: { onSuccess: () => void }) => (
        <div data-testid="sign-in">
            <button type="button" onClick={onSuccess}>signed in</button>
        </div>
    ),
}))

let InPlaceSignInWrapper: typeof import('../InPlaceSignInWrapper').default
let InPlaceSignInContext: typeof import('../../../../context/InPlaceSignInContext/InPlaceSignInContext').InPlaceSignInContext

beforeAll(async () => {
    InPlaceSignInWrapper = (await import('../InPlaceSignInWrapper')).default
    InPlaceSignInContext = (await import('../../../../context/InPlaceSignInContext/InPlaceSignInContext')).InPlaceSignInContext
})

beforeEach(() => cleanup())

describe('InPlaceSignInWrapper', () => {
    it('shows the children while the sign-in flag is down', () => {
        render(
            <InPlaceSignInContext.Provider value={{ value: false, setValue: () => undefined } as never}>
                <InPlaceSignInWrapper>
                    <div data-testid="content">hodnocení</div>
                </InPlaceSignInWrapper>
            </InPlaceSignInContext.Provider>,
        )

        expect(screen.getByTestId('content')).toBeTruthy()
        expect(screen.queryByTestId('sign-in')).toBeNull()
    })

    it('swaps the children for the sign-in panel, and back after success', () => {
        let flag = true
        const setValue = (value: boolean) => { flag = value }
        const renderWrapper = () =>
            render(
                <InPlaceSignInContext.Provider value={{ value: flag, setValue } as never}>
                    <InPlaceSignInWrapper>
                        <div data-testid="content">hodnocení</div>
                    </InPlaceSignInWrapper>
                </InPlaceSignInContext.Provider>,
            )

        const { unmount } = renderWrapper()
        expect(screen.getByTestId('sign-in')).toBeTruthy()
        expect(screen.queryByTestId('content')).toBeNull()

        // Success drops the flag and the content returns.
        fireEvent.click(screen.getByText('signed in'))
        unmount()

        const second = render(
            <InPlaceSignInContext.Provider value={{ value: flag, setValue } as never}>
                <InPlaceSignInWrapper>
                    <div data-testid="content">hodnocení</div>
                </InPlaceSignInWrapper>
            </InPlaceSignInContext.Provider>,
        )
        expect(second.getByTestId('content')).toBeTruthy()
        expect(second.queryByTestId('sign-in')).toBeNull()
    })
})
