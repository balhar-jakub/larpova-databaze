/**
 * @jest-environment jsdom
 */
/**
 * The two small context providers: FirstRender is true only during the
 * very first render, InPlaceSignIn carries the sign-in flag and its
 * setter.
 */
import React, {useContext, useState} from 'react'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

const observed: boolean[] = []
const signInValues: boolean[] = []

beforeEach(() => {
    cleanup()
    observed.length = 0
    signInValues.length = 0
})

describe('FirstRenderContextProvider', () => {
    it('exposes true on the first render and false on the next ones', async () => {
        const { default: Provider } = await import('../FirstRenderContext/FirstRenderContextProvider')
        const { FirstRenderContext } = await import('../FirstRenderContext/FirstRenderContext')

        const Probe = () => {
            observed.push(useContext(FirstRenderContext))
            return null
        }

        const App = () => {
            const [, setTick] = useState(0)
            return (
                <Provider>
                    <Probe />
                    <button type="button" onClick={() => setTick(t => t + 1)}>rerender</button>
                </Provider>
            )
        }

        const { getByText } = render(<App />)
        expect(observed[0]).toBe(true)

        act(() => {
            fireEvent.click(getByText('rerender'))
        })
        // After the mount effect cleared the flag, the next render sees false.
        expect(observed.at(-1)).toBe(false)
    })
})

describe('InPlaceSignInContextProvider', () => {
    it('starts false and the setter flips it for the consumers', async () => {
        const { InPlaceSignInContextProvider: Provider } = await import('../InPlaceSignInContext/InPlaceSignInContextProvider')
        const { InPlaceSignInContext } = await import('../InPlaceSignInContext/InPlaceSignInContext')

        const Probe = () => {
            const context = useContext(InPlaceSignInContext)
            signInValues.push(context.value)
            return <button type="button" onClick={() => context.setValue(true)}>flip</button>
        }

        const { getByText } = render(
            <Provider>
                <Probe />
            </Provider>,
        )
        expect(signInValues.at(-1)).toBe(false)

        act(() => {
            fireEvent.click(getByText('flip'))
        })
        expect(signInValues.at(-1)).toBe(true)
    })
})
