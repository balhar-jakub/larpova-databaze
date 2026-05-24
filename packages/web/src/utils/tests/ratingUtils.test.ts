import { getRatingForGame, getRatingGrade } from '../ratingUtils'

describe('getRatingGrade', () => {
    it('should return notrated for null', () => {
        expect(getRatingGrade()).toBe('notrated')
    })

    it('should return notrated for 0', () => {
        expect(getRatingGrade(0)).toBe('notrated')
    })

    it('should return mediocre for 1', () => {
        expect(getRatingGrade(1)).toBe('mediocre')
    })

    it('should return mediocre for 39', () => {
        expect(getRatingGrade(39)).toBe('mediocre')
    })

    it('should return average for 40', () => {
        expect(getRatingGrade(40)).toBe('average')
    })

    it('should return average for 69', () => {
        expect(getRatingGrade(69)).toBe('average')
    })

    it('should return great for 70', () => {
        expect(getRatingGrade(70)).toBe('great')
    })

    it('should return great for 100', () => {
        expect(getRatingGrade(100)).toBe('great')
    })
})

describe('getRatingForGame', () => {
    it('should not return rating for less that 5 ratings', () => {
        expect(getRatingForGame(4, 90)).toBe('notrated')
    })

    it('should not return rating for 5 and more ratings', () => {
        expect(getRatingForGame(5, 90)).toBe('great')
    })
})
