/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { jest, describe, it, expect, beforeAll } from '@jest/globals'

// The panel renders OpenGraphMeta, which needs the router and the head manager.
jest.unstable_mockModule('next/router', () => ({
    useRouter: () => ({ asPath: '/ochrana-osobnich-udaju', query: {}, push: () => undefined }),
}))
jest.unstable_mockModule('next/head', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let PrivacyPolicyPanel: typeof import('../PrivacyPolicyPanel').PrivacyPolicyPanel

beforeAll(async () => {
    PrivacyPolicyPanel = (await import('../PrivacyPolicyPanel')).PrivacyPolicyPanel
})

/**
 * The privacy policy is a legal statement, so the assertions are the claims a
 * reader (or a regulator) would check: who the controller is, how to reach them,
 * which cookies exist, that analytics needs consent, that Google is named as a
 * processor, and that deletion is possible and how.
 *
 * These pin the promise, not the styling. If the app starts storing something new
 * (the Google identity, for example), this test file is where the missing sentence
 * should be noticed — the page and the code drift silently otherwise.
 */

describe('PrivacyPolicyPanel', () => {
    it('names the controller and a contact address', () => {
        render(<PrivacyPolicyPanel />)

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ochrana osobních údajů')
        expect(screen.getAllByText('larpovadatabaze@gmail.com').length).toBeGreaterThan(0)
        expect(screen.getByText(/provozuje tým dobrovolníků/i)).toBeTruthy()
    })

    it('lists what is public and what stays private', () => {
        render(<PrivacyPolicyPanel />)

        expect(screen.getByText(/Co je veřejné a co ne/i)).toBeTruthy()
        expect(screen.getByText(/e-mail \(ten vidíte jen vy a správci\)/i)).toBeTruthy()
        // The age is shown, the birth date is not — the code computes one from the other.
        expect(screen.getByText(/věk \(ten počítáme z data narození/i)).toBeTruthy()
    })

    it('describes the cookies the app actually sets', () => {
        render(<PrivacyPolicyPanel />)

        // Mentioned twice on purpose: once among the stored items, once in the table.
        expect(screen.getAllByText('csld.sid').length).toBeGreaterThan(0)
        expect(screen.getAllByText('LoggedIn').length).toBeGreaterThan(0)
        expect(screen.getAllByText('csld-ga-consent').length).toBeGreaterThan(0)
    })

    it('says analytics needs consent and names Google as the processor', () => {
        render(<PrivacyPolicyPanel />)

        expect(screen.getByText(/jen s vaším souhlasem/i)).toBeTruthy()
        expect(screen.getByText(/Google Ireland Ltd\./)).toBeTruthy()
        expect(screen.getByText(/reCAPTCHA/)).toBeTruthy()
    })

    it('explains deletion and the supervisory authority', () => {
        render(<PrivacyPolicyPanel />)

        expect(screen.getByText(/Nechat je smazat/i)).toBeTruthy()
        expect(screen.getByText(/smažeme i s tím, co k němu patří/i)).toBeTruthy()
        expect(screen.getByText(/Úřad pro ochranu osobních údajů/)).toBeTruthy()
    })

    it('mentions that backups live outside the delete button', () => {
        render(<PrivacyPolicyPanel />)

        expect(screen.getByText(/historii záloh 180/i)).toBeTruthy()
        expect(screen.getByText(/nejpozději do půl roku od výmazu/i)).toBeTruthy()
    })
})
