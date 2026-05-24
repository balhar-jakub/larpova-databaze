import { toChunks } from '../chunkUtils'

describe('toChunks', () => {
    test('converting empty array', () => {
        expect(toChunks([], 5)).toEqual([])
    })

    test('converting overflowing array', () => {
        expect(toChunks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 5)).toEqual([
            [1, 2, 3, 4, 5],
            [6, 7, 8, 9, 10],
            [11, 12, 13, 14, 15],
            [16],
        ])
    })

    test('converting array that is multiple of chunk size', () => {
        expect(toChunks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 5)).toEqual([
            [1, 2, 3, 4, 5],
            [6, 7, 8, 9, 10],
            [11, 12, 13, 14, 15],
        ])
    })
})
