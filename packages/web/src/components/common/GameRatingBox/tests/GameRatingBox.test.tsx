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

    test('render the weakest level (thumbs down, filled)', async () => {
        const tree = render(<GameRatingBox rating={25} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingStronglyNotRecommended'))
        expect(wrapper.className).not.toEqual(expect.stringContaining('Outline'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.stronglyNotRecommended')
        expect(wrapper.querySelector('svg')?.getAttribute('data-icon')).toBe('thumbs-down')
    })

    test('render the milder warning (thumbs down, outlined)', async () => {
        const tree = render(<GameRatingBox rating={37.6} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingNotRecommendedOutline'))
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.notRecommended')
        expect(wrapper.querySelector('svg')?.getAttribute('data-icon')).toBe('thumbs-down')
    })

    test('render the neutral level (horizontal thumb, filled)', async () => {
        const tree = render(<GameRatingBox rating={59.3} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingNeutral'))
        expect(wrapper.className).not.toEqual(expect.stringContaining('Outline'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.neutral')
        const icon = wrapper.querySelector('svg')
        expect(icon?.getAttribute('data-icon')).toBe('thumbs-up')
        // The neutral level reuses the thumbs-up glyph, rotated onto its side.
        expect(icon?.getAttribute('class')).toEqual(expect.stringContaining('fa-rotate-90'))
    })

    test('render the milder recommendation (thumbs up, outlined)', async () => {
        const tree = render(<GameRatingBox rating={75} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingRecommendedOutline'))
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.recommended')
        expect(wrapper.querySelector('svg')?.getAttribute('data-icon')).toBe('thumbs-up')
    })

    test('render the strongest level (thumbs up, filled)', async () => {
        const tree = render(<GameRatingBox rating={100} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingStronglyRecommended'))
        expect(wrapper.className).not.toEqual(expect.stringContaining('Outline'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.getAttribute('aria-label')).toBe('Rating.stronglyRecommended')
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
        expect(wrapper.className).toEqual(expect.stringContaining('ratingStronglyRecommended'))
        expect(wrapper.textContent).toBe('')
        expect(wrapper.querySelector('svg')).toBeNull()
        expect(wrapper.getAttribute('aria-label')).toBeNull()
    })

    test('tiny has no room for an outline, so a milder level takes the colour alone', async () => {
        const tree = render(<GameRatingBox rating={75} amountOfRatings={5} size="tiny" />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingRecommended'))
        expect(wrapper.className).not.toEqual(expect.stringContaining('Outline'))
        expect(wrapper.textContent).toBe('')
    })
})
