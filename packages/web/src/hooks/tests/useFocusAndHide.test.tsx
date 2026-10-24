/**
 * @jest-environment jsdom
 */
/**
 * useFocusInput: focuses the named input once it exists, retrying on an
 * interval because the form can be lazy-loaded. useHideInPlaceLogin:
 * hides the in-place sign-in through the context.
 */
import React, { useRef } from 'react'
import { render, waitFor, cleanup } from '@testing-library/react'
import { useFocusInput } from '../useFocusInput'
import { useHideInPlaceLogin } from '../useHideInPlaceLogin'
import { InPlaceSignInContext } from '../../context/InPlaceSignInContext/InPlaceSignInContext'

beforeEach(() => cleanup())

describe('useFocusInput', () => {
    it('focuses the named input once it appears', async () => {
        const Probe = () => {
            const ref = useFocusInput<HTMLFormElement>('query')
            return (
                <form ref={ref}>
                    <input type="text" name="query" data-testid="focused" readOnly />
                </form>
            )
        }

        render(<Probe />)

        await waitFor(() => {
            expect(document.activeElement).toBe(document.querySelector('[data-testid="focused"]'))
        })
    })
})

describe('useHideInPlaceLogin', () => {
    it('flips the sign-in flag down through the context', () => {
        const values: boolean[] = []
        const Probe = () => {
            const hide = useHideInPlaceLogin()
            return <button type="button" onClick={() => { hide(); values.push(true) }}>hide</button>
        }

        const contextValue = { value: true, setValue: (value: boolean) => { values.push(value) } }
        const { getByText } = render(
            <InPlaceSignInContext.Provider value={contextValue}>
                <Probe />
            </InPlaceSignInContext.Provider>,
        )

        getByText('hide').click()
        expect(values).toEqual([false, true])
    })
})
