/**
 * @jest-environment jsdom
 */
/**
 * useRemoveServerSideCss: after mount the jss-ssr style element is
 * removed from the document so styles are not duplicated.
 */
import React from 'react'
import { render } from '@testing-library/react'
import { useRemoveServerSideCss } from '../useRemoveServerSideCss'

const Probe = () => {
    useRemoveServerSideCss()
    return <div>probe</div>
}

describe('useRemoveServerSideCss', () => {
    it('removes the jss-ssr element on mount', () => {
        const style = document.createElement('style')
        style.id = 'jss-ssr'
        document.head.appendChild(style)
        expect(document.getElementById('jss-ssr')).toBeTruthy()

        render(<Probe />)

        expect(document.getElementById('jss-ssr')).toBeNull()
    })

    it('is a no-op without the element', () => {
        render(<Probe />)
        // Nothing to remove — no crash.
        expect(document.getElementById('jss-ssr')).toBeNull()
    })
})
