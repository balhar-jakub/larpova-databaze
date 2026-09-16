export const MIN_NUM_RATINGS = 5

/**
 * Recommendation bands.
 *
 * Aggregate ratings (`average_rating`, `averageRating`) live on a 0-100 scale —
 * a game rated 8/10 has 80 there. Individual ratings (`Rating.rating`) are on a
 * 1-10 scale, so convert them with getRecommendationForTenPointRating.
 *
 *   80 - 100  recommended
 *   40 -  79  neutral
 *    1 -  39  not recommended
 */
export const RECOMMENDED_FROM = 80
export const NEUTRAL_FROM = 40

export type RatingGrade = 'notrated' | 'mediocre' | 'average' | 'great'
export type RatingRecommendation = 'notrated' | 'notRecommended' | 'neutral' | 'recommended'

export const getRatingGrade = (rating?: number): RatingGrade => {
    if (!rating) {
        return 'notrated'
    }
    if (rating < NEUTRAL_FROM) {
        return 'mediocre'
    }
    if (rating < RECOMMENDED_FROM) {
        return 'average'
    }
    return 'great'
}

export const getRatingForGame = (amountOfRatings: number, rating?: number): RatingGrade =>
    amountOfRatings < MIN_NUM_RATINGS ? getRatingGrade() : getRatingGrade(rating)

const RECOMMENDATION_BY_GRADE: { [key in RatingGrade]: RatingRecommendation } = {
    notrated: 'notrated',
    mediocre: 'notRecommended',
    average: 'neutral',
    great: 'recommended',
}

export const gradeForRecommendation: { [key in RatingRecommendation]: RatingGrade } = {
    notrated: 'notrated',
    notRecommended: 'mediocre',
    neutral: 'average',
    recommended: 'great',
}

export const getRecommendation = (rating?: number): RatingRecommendation =>
    RECOMMENDATION_BY_GRADE[getRatingGrade(rating)]

export const getRecommendationForGame = (amountOfRatings: number, rating?: number): RatingRecommendation =>
    RECOMMENDATION_BY_GRADE[getRatingForGame(amountOfRatings, rating)]

/** Individual ratings are stored on a 1-10 scale, recommendation bands are 0-100. */
export const getRecommendationForTenPointRating = (rating?: number): RatingRecommendation =>
    getRecommendation(rating == null ? undefined : rating * 10)

/** i18n key of a recommendation label — translate it in the component. */
export const recommendationKey = (recommendation: RatingRecommendation) => `Rating.${recommendation}`
