import { generatePageOffsets } from '../pagerUtils'

describe('generatePageOffsets', () => {
    test('few pages', () => {
        const res = generatePageOffsets(0, 300, 100, 10)
        expect(res).toEqual([0, 100, 200, 300])
    })

    describe('too many pages, even number of visible pages', () => {
        test('on first page', () => {
            const res = generatePageOffsets(0, 1500, 100, 10)
            expect(res).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900])
        })

        test('on page 3', () => {
            const res = generatePageOffsets(200, 1500, 100, 10)
            expect(res).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900])
        })

        test('on page 4', () => {
            const res = generatePageOffsets(300, 1500, 100, 10)
            expect(res).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900])
        })

        test('on page 5', () => {
            const res = generatePageOffsets(400, 1500, 100, 10)
            expect(res).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900])
        })

        test('on page 6', () => {
            const res = generatePageOffsets(500, 1500, 100, 10)
            expect(res).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
        })

        test('on page 7', () => {
            const res = generatePageOffsets(600, 1500, 100, 10)
            expect(res).toEqual([200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100])
        })

        test('on last page', () => {
            const res = generatePageOffsets(1500, 1500, 100, 10)
            expect(res).toEqual([600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500])
        })
    })

    describe('too many pages, odd number of visible pages', () => {
        test('on first page', () => {
            const res = generatePageOffsets(0, 1500, 100, 9)
            expect(res).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800])
        })

        test('on page 3', () => {
            const res = generatePageOffsets(200, 1500, 100, 9)
            expect(res).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800])
        })

        test('on page 4', () => {
            const res = generatePageOffsets(300, 1500, 100, 9)
            expect(res).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800])
        })

        test('on page 5', () => {
            const res = generatePageOffsets(400, 1500, 100, 9)
            expect(res).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800])
        })

        test('on page 6', () => {
            const res = generatePageOffsets(500, 1500, 100, 9)
            expect(res).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900])
        })

        test('on page 7', () => {
            const res = generatePageOffsets(600, 1500, 100, 9)
            expect(res).toEqual([200, 300, 400, 500, 600, 700, 800, 900, 1000])
        })

        test('on last page', () => {
            const res = generatePageOffsets(1500, 1500, 100, 9)
            expect(res).toEqual([700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500])
        })
    })
})
