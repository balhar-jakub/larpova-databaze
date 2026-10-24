/**
 * @jest-environment jsdom
 */
/**
 * The confirmation modal's text fallbacks: without custom button texts the
 * generic keys show, and with them the caller's wording wins. The component
 * was 0%-covered — every panel that confirms a destructive action leans on it.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('react-bootstrap', () => {
    const Modal = ({ show, children }: { show: boolean; children: React.ReactNode }) =>
        show ? <div data-testid="modal">{children}</div> : null
    const part = (name: string) => ({ children }: { children?: React.ReactNode }) => <div data-part={name}>{children}</div>
    Modal.Header = part('header')
    Modal.Title = part('title')
    Modal.Body = part('body')
    Modal.Footer = part('footer')
    return {
        Modal,
        Button: ({ children, onClick, variant }: { children: React.ReactNode; onClick?: () => void; variant?: string }) => (
            <button type="button" data-variant={variant} onClick={onClick}>{children}</button>
        ),
    }
})

let ConfirmationModal: typeof import('../ConfirmationModal').default

beforeAll(async () => {
    ConfirmationModal = (await import('../ConfirmationModal')).default
})

beforeEach(() => cleanup())

describe('ConfirmationModal', () => {
    it('shows the generic title and both button texts when none are given', () => {
        render(
            <ConfirmationModal
                show
                content={<span>content</span>}
                onConfirm={() => undefined}
                onCancel={() => undefined}
                onHide={() => undefined}
            />,
        )

        expect(screen.getByText(translate(cs, 'ConfirmationModal.title'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'ConfirmationModal.cancel'))).toBeTruthy()
        expect(screen.getByText(translate(cs, 'ConfirmationModal.confirm'))).toBeTruthy()
    })

    it('prefers the caller wording for the title and both buttons', () => {
        render(
            <ConfirmationModal
                show
                title="Smazat hru?"
                content={<span>content</span>}
                cancelButtonText="Nemazat"
                confirmButtonText="Smazat"
                onConfirm={() => undefined}
                onCancel={() => undefined}
                onHide={() => undefined}
            />,
        )

        expect(screen.getByText('Smazat hru?')).toBeTruthy()
        expect(screen.getByText('Nemazat')).toBeTruthy()
        expect(screen.getByText('Smazat')).toBeTruthy()
        expect(screen.queryByText(translate(cs, 'ConfirmationModal.title'))).toBeNull()
    })

    it('stays hidden and fires both callbacks from its buttons', () => {
        let confirmed = 0
        let canceled = 0
        const { rerender } = render(
            <ConfirmationModal show={false} content={<span>c</span>} onConfirm={() => { confirmed += 1 }} onCancel={() => { canceled += 1 }} onHide={() => undefined} />,
        )
        expect(screen.queryByTestId('modal')).toBeNull()

        rerender(
            <ConfirmationModal show content={<span>c</span>} onConfirm={() => { confirmed += 1 }} onCancel={() => { canceled += 1 }} onHide={() => undefined} />,
        )
        fireEvent.click(screen.getByText(translate(cs, 'ConfirmationModal.confirm')))
        fireEvent.click(screen.getByText(translate(cs, 'ConfirmationModal.cancel')))
        expect(confirmed).toBe(1)
        expect(canceled).toBe(1)
    })
})
