import {
    getRatingForGame,
    getRatingGrade,
    getRecommendation,
    getRecommendationForGame,
    getRecommendationForTenPointRating,
    recommendationKey,
} from '../ratingUtils'

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

    it('should return average for 79', () => {
        expect(getRatingGrade(79)).toBe('average')
    })

    it('should return great for 80', () => {
        expect(getRatingGrade(80)).toBe('great')
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

describe('getRecommendation', () => {
    it('should map the missing rating to notrated', () => {
        expect(getRecommendation()).toBe('notrated')
        expect(getRecommendation(0)).toBe('notrated')
    })

    it('should recommend 8, 9 and 10 points out of ten', () => {
        expect(getRecommendation(80)).toBe('recommended')
        expect(getRecommendation(90)).toBe('recommended')
        expect(getRecommendation(100)).toBe('recommended')
    })

    it('should be neutral between 4 and 7 points out of ten', () => {
        expect(getRecommendation(40)).toBe('neutral')
        expect(getRecommendation(50)).toBe('neutral')
        expect(getRecommendation(70)).toBe('neutral')
        expect(getRecommendation(79)).toBe('neutral')
    })

    it('should not recommend 1 to 3 points out of ten', () => {
        expect(getRecommendation(1)).toBe('notRecommended')
        expect(getRecommendation(30)).toBe('notRecommended')
        expect(getRecommendation(39)).toBe('notRecommended')
    })
})

describe('getRecommendationForGame', () => {
    it('should not recommend anything below 5 ratings', () => {
        expect(getRecommendationForGame(4, 90)).toBe('notrated')
    })

    it('should use the recommendation from 5 ratings', () => {
        expect(getRecommendationForGame(5, 90)).toBe('recommended')
        expect(getRecommendationForGame(5, 60)).toBe('neutral')
        expect(getRecommendationForGame(5, 20)).toBe('notRecommended')
    })
})

describe('getRecommendationForTenPointRating', () => {
    it('should handle the 1-10 scale', () => {
        expect(getRecommendationForTenPointRating(1)).toBe('notRecommended')
        expect(getRecommendationForTenPointRating(3)).toBe('notRecommended')
        expect(getRecommendationForTenPointRating(4)).toBe('neutral')
        expect(getRecommendationForTenPointRating(7)).toBe('neutral')
        expect(getRecommendationForTenPointRating(8)).toBe('recommended')
        expect(getRecommendationForTenPointRating(10)).toBe('recommended')
    })

    it('should treat a missing rating as notrated', () => {
        expect(getRecommendationForTenPointRating(undefined)).toBe('notrated')
    })
})

describe('recommendationKey', () => {
    it('should build the i18n key', () => {
        expect(recommendationKey('recommended')).toBe('Rating.recommended')
        expect(recommendationKey('neutral')).toBe('Rating.neutral')
        expect(recommendationKey('notRecommended')).toBe('Rating.notRecommended')
        expect(recommendationKey('notrated')).toBe('Rating.notrated')
    })
})
