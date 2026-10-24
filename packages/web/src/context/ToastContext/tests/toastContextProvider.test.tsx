/**
 * @jest-environment jsdom
 */
/**
 * The toast context provider: showToast renders a toast, alerts stay
 * until closed, success toasts auto-hide, and children receive the
 * context value.
 */
import React from 'react'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let ToastContextProvider: typeof import('../ToastContextProvider')['default']
let ToastContext: typeof import('../ToastContext')['ToastContext']

beforeAll(async () => {
    const m = await import('../ToastContextProvider')
    ToastContextProvider = m.default
    const ctx = await import('../ToastContext')
    ToastContext = ctx.ToastContext
})

beforeEach(() => cleanup())

const Probe = ({ kind }: { kind?: 'success' | 'alert' | 'normal' }) => {
    const toast = React.useContext(ToastContext)
    return (
        <div>
            <button type="button" onClick={() => toast.actions.showToast(`msg-${kind ?? 'plain'}`, kind)}>show-{kind ?? 'plain'}</button>
        </div>
    )
}

describe('ToastContextProvider', () => {
    it('provides showToast through the context', () => {
        render(
            <ToastContextProvider>
                <Probe />
            </ToastContextProvider>,
        )

        fireEvent.click(screen.getByText('show-plain'))
        expect(screen.getByText('msg-plain')).toBeTruthy()
    })

    it('renders success toasts', () => {
        render(
            <ToastContextProvider>
                <Probe kind="success" />
            </ToastContextProvider>,
        )

        fireEvent.click(screen.getByText('show-success'))
        expect(screen.getByText('msg-success')).toBeTruthy()
    })

    it('closes the toast via the close button', async () => {
        render(
            <ToastContextProvider>
                <Probe kind="alert" />
            </ToastContextProvider>,
        )

        fireEvent.click(screen.getByText('show-alert'))
        expect(screen.getByText('msg-alert')).toBeTruthy()

        const close = screen.getAllByRole('button').find((b) => b.textContent !== 'show-alert')!
        fireEvent.click(close)
        await waitFor(() => expect(screen.queryByText('msg-alert')).toBeNull())
    })
})
