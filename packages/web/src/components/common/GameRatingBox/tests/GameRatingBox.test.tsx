/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render } from '@testing-library/react'
import { GameRatingBox } from '../GameRatingBox'
import { componentTestIds } from '../../../componentTestIds'

// Labels are rendered through useTranslation. Without a provider the i18n
// hook returns the key itself, so these tests assert the i18n keys (and the
// band colours) rather than Czech copy.
describe('GameRatingBox', () => {
    test('render with no rating', async () => {
        const tree = render(<GameRatingBox rating={0} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingNotRated'))
        expect(wrapper.textContent).toBe('Rating.notrated')
    })

    test('render with a not recommended rating', async () => {
        const tree = render(<GameRatingBox rating={37.6} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingMediocre'))
        expect(wrapper.textContent).toBe('Rating.notRecommended')
    })

    test('render with a neutral rating', async () => {
        const tree = render(<GameRatingBox rating={59.3} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingAverage'))
        expect(wrapper.textContent).toBe('Rating.neutral')
    })

    test('render with a recommended rating', async () => {
        const tree = render(<GameRatingBox rating={100} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingGreat'))
        expect(wrapper.textContent).toBe('Rating.recommended')
    })

    test('render no recommendation below the minimum number of ratings', async () => {
        const tree = render(<GameRatingBox rating={95} amountOfRatings={4} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingNotRated'))
        expect(wrapper.textContent).toBe('Rating.notrated')
    })

    test('render without a label in tiny size', async () => {
        const tree = render(<GameRatingBox rating={95} amountOfRatings={5} size="tiny" />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingGreat'))
        expect(wrapper.textContent).toBe('')
    })
})
