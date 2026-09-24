/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render } from '@testing-library/react'
import { GameRatingBox } from '../GameRatingBox'
import { componentTestIds } from '../../../componentTestIds'

// Labels are exposed through useTranslation. Without a provider the i18n hook
// returns the key itself, so these tests assert the i18n keys (and the band
// colours) rather than Czech copy. The square itself renders an icon, never
// text — that is what the icon assertions below pin down.
describe('GameRatingBox', () => {
    test('render with no rating', async () => {
        const tree = render(<GameRatingBox rating={0} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingNotRated'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.notrated')
        expect(wrapper.querySelector('svg')?.getAttribute('data-icon')).toBe('question')
    })

    test('render with a not recommended rating (thumbs down)', async () => {
        const tree = render(<GameRatingBox rating={37.6} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingMediocre'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.notRecommended')
        expect(wrapper.querySelector('svg')?.getAttribute('data-icon')).toBe('thumbs-down')
    })

    test('render with a neutral rating (horizontal thumb)', async () => {
        const tree = render(<GameRatingBox rating={59.3} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingAverage'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.neutral')
        const icon = wrapper.querySelector('svg')
        expect(icon?.getAttribute('data-icon')).toBe('thumbs-up')
        // The neutral band reuses the thumbs-up glyph, rotated onto its side.
        expect(icon?.getAttribute('class')).toEqual(expect.stringContaining('fa-rotate-90'))
    })

    test('render with a recommended rating (thumbs up)', async () => {
        const tree = render(<GameRatingBox rating={100} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingGreat'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.recommended')
        expect(wrapper.querySelector('svg')?.getAttribute('data-icon')).toBe('thumbs-up')
    })

    test('render no recommendation below the minimum number of ratings', async () => {
        const tree = render(<GameRatingBox rating={95} amountOfRatings={4} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingNotRated'))
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.notrated')
        expect(wrapper.querySelector('svg')?.getAttribute('data-icon')).toBe('question')
    })

    test('render colour only, without an icon, in tiny size', async () => {
        const tree = render(<GameRatingBox rating={95} amountOfRatings={5} size="tiny" />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingGreat'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.querySelector('svg')).toBeNull()
        expect(wrapper.getAttribute('aria-label')).toBeNull()
    })
})
