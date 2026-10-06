import {
    getRecommendation,
    getRecommendationForGame,
    getRecommendationForTenPointRating,
    recommendationKey,
    RATING_BANDS,
    RECOMMENDED_FROM,
} from '../ratingUtils'

describe('getRecommendation', () => {
    it('should map the missing rating to notrated', () => {
        expect(getRecommendation()).toBe('notrated')
        expect(getRecommendation(0)).toBe('notrated')
    })

    it('should read the five levels off the 0-100 scale', () => {
        expect(getRecommendation(100)).toBe('stronglyRecommended')
        expect(getRecommendation(90)).toBe('stronglyRecommended')
        expect(getRecommendation(89)).toBe('recommended')
        expect(getRecommendation(RECOMMENDED_FROM)).toBe('recommended')
        expect(getRecommendation(69)).toBe('neutral')
        expect(getRecommendation(50)).toBe('neutral')
        expect(getRecommendation(49)).toBe('notRecommended')
        expect(getRecommendation(30)).toBe('notRecommended')
        expect(getRecommendation(29)).toBe('stronglyNotRecommended')
        expect(getRecommendation(1)).toBe('stronglyNotRecommended')
    })
})

describe('getRecommendationForGame', () => {
    it('should not rate a game with fewer than five ratings', () => {
        expect(getRecommendationForGame(4, 95)).toBe('notrated')
    })

    it('should use the level of the average from five ratings', () => {
        expect(getRecommendationForGame(5, 95)).toBe('stronglyRecommended')
        expect(getRecommendationForGame(5, 75)).toBe('recommended')
        expect(getRecommendationForGame(5, 60)).toBe('neutral')
        expect(getRecommendationForGame(5, 40)).toBe('notRecommended')
        expect(getRecommendationForGame(5, 20)).toBe('stronglyNotRecommended')
    })
})

describe('getRecommendationForTenPointRating', () => {
    it('should read a 1-10 vote through the same bands', () => {
        expect(getRecommendationForTenPointRating(10)).toBe('stronglyRecommended')
        expect(getRecommendationForTenPointRating(9)).toBe('stronglyRecommended')
        expect(getRecommendationForTenPointRating(8)).toBe('recommended')
        expect(getRecommendationForTenPointRating(7)).toBe('recommended')
        expect(getRecommendationForTenPointRating(6)).toBe('neutral')
        expect(getRecommendationForTenPointRating(5)).toBe('neutral')
        expect(getRecommendationForTenPointRating(4)).toBe('notRecommended')
        expect(getRecommendationForTenPointRating(3)).toBe('notRecommended')
        expect(getRecommendationForTenPointRating(2)).toBe('stronglyNotRecommended')
        expect(getRecommendationForTenPointRating(1)).toBe('stronglyNotRecommended')
    })

    it('should treat a missing rating as notrated', () => {
        expect(getRecommendationForTenPointRating(undefined)).toBe('notrated')
    })
})

describe('recommendationKey', () => {
    it('should build the i18n key', () => {
        expect(recommendationKey('stronglyRecommended')).toBe('Rating.stronglyRecommended')
        expect(recommendationKey('recommended')).toBe('Rating.recommended')
        expect(recommendationKey('neutral')).toBe('Rating.neutral')
        expect(recommendationKey('notRecommended')).toBe('Rating.notRecommended')
        expect(recommendationKey('stronglyNotRecommended')).toBe('Rating.stronglyNotRecommended')
        expect(recommendationKey('notrated')).toBe('Rating.notrated')
    })
})

describe('RATING_BANDS', () => {
    it('should list the five levels, strongest first', () => {
        expect(RATING_BANDS.map(band => band.recommendation)).toEqual([
            'stronglyRecommended',
            'recommended',
            'neutral',
            'notRecommended',
            'stronglyNotRecommended',
        ])
    })

    it('should pair the votes the way people use them', () => {
        expect(RATING_BANDS.map(band => band.readings)).toEqual([[9, 10], [7, 8], [5, 6], [3, 4], [1, 2]])
    })

    it('should cover every vote exactly once', () => {
        expect(RATING_BANDS.flatMap(band => band.readings).sort((a, b) => a - b)).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ])
    })

    it('should leave no hole between the bands', () => {
        expect(RATING_BANDS.map(band => band.from)).toEqual([90, RECOMMENDED_FROM, 50, 30, 0])
    })

    it('should store the middle value of each level', () => {
        expect(RATING_BANDS.map(band => band.storedRating)).toEqual([10, 8, 6, 4, 2])
    })

    it('should store a value that reads back as its own level', () => {
        RATING_BANDS.forEach(({ recommendation, storedRating }) => {
            expect(getRecommendationForTenPointRating(storedRating)).toBe(recommendation)
        })
    })

    it('should keep every stored value inside 1-10', () => {
        RATING_BANDS.forEach(({ storedRating }) => {
            expect(storedRating).toBeGreaterThanOrEqual(1)
            expect(storedRating).toBeLessThanOrEqual(10)
        })
    })
})
