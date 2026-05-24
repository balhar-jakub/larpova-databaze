import React from 'react'
import { render } from '@testing-library/react'
import { GameRatingBox } from '../GameRatingBox'
import { componentTestIds } from '../../../componentTestIds'

describe('GameRatingBox', () => {
    test('render with no rating', async () => {
        const tree = render(<GameRatingBox rating={0} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingNotRated'))
        expect(wrapper.textContent).toBe('-')
    })

    test('render with mediocre rating', async () => {
        const tree = render(<GameRatingBox rating={37.6} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingMediocre'))
        expect(wrapper.textContent).toBe('3.8')
    })

    test('render with average rating', async () => {
        const tree = render(<GameRatingBox rating={59.3} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingAverage'))
        expect(wrapper.textContent).toBe('5.9')
    })

    test('render with great rating', async () => {
        const tree = render(<GameRatingBox rating={100} amountOfRatings={5} />)

        const wrapper = await tree.findByTestId(componentTestIds.gameRatingBox.wrapper)
        expect(wrapper.className).toEqual(expect.stringContaining('ratingGreat'))
        expect(wrapper.textContent).toBe('10.0')
    })
})
