export const MIN_NUM_RATINGS = 5

/**
 * Five recommendation levels.
 *
 * Aggregate ratings (`averageRating`, `average_rating`) live on a 0-100 scale —
 * a game rated 8/10 has 80 there — while individual votes (`Rating.rating`) are
 * the same scale divided by ten, so a stored vote is read through
 * getRecommendationForTenPointRating.
 *
 * The cuts fall between the vote pairs people actually use (9-10, 7-8, 5-6, 3-4,
 * 1-2), so every rating stored while the input had ten stars keeps its meaning:
 *
 *   90 - 100  stronglyRecommended
 *   70 -  89  recommended
 *   50 -  69  neutral
 *   30 -  49  notRecommended
 *    0 -  29  stronglyNotRecommended
 */
export const STRONGLY_RECOMMENDED_FROM = 90
export const RECOMMENDED_FROM = 70
export const NEUTRAL_FROM = 50
export const NOT_RECOMMENDED_FROM = 30

export type RatingRecommendation =
    | 'notrated'
    | 'stronglyNotRecommended'
    | 'notRecommended'
    | 'neutral'
    | 'recommended'
    | 'stronglyRecommended'

export interface RatingBand {
    /** Level the band reads as. */
    readonly recommendation: RatingRecommendation
    /** Lowest average (0-100) that belongs to the band. */
    readonly from: number
    /** The votes (1-10) that belong to the band. */
    readonly readings: readonly number[]
    /**
     * Value the input stores when this band is picked. It only has to sit inside
     * its own band, so the middle of the band is used — that keeps new ratings
     * comparable with the 17 000 stored before the input became a choice.
     */
    readonly storedRating: number
}

/** All five levels, strongest first — input, chart and badge share this order. */
export const RATING_BANDS: readonly RatingBand[] = [
    { recommendation: 'stronglyRecommended', from: STRONGLY_RECOMMENDED_FROM, readings: [9, 10], storedRating: 10 },
    { recommendation: 'recommended', from: RECOMMENDED_FROM, readings: [7, 8], storedRating: 8 },
    { recommendation: 'neutral', from: NEUTRAL_FROM, readings: [5, 6], storedRating: 6 },
    { recommendation: 'notRecommended', from: NOT_RECOMMENDED_FROM, readings: [3, 4], storedRating: 4 },
    { recommendation: 'stronglyNotRecommended', from: 0, readings: [1, 2], storedRating: 2 },
]

export const getRecommendation = (rating?: number): RatingRecommendation => {
    if (!rating) {
        return 'notrated'
    }

    return RATING_BANDS.find(band => rating >= band.from)?.recommendation ?? 'notrated'
}

export const getRecommendationForGame = (amountOfRatings: number, rating?: number): RatingRecommendation =>
    amountOfRatings < MIN_NUM_RATINGS ? 'notrated' : getRecommendation(rating)

/** Individual ratings are stored on a 1-10 scale, the bands are 0-100. */
export const getRecommendationForTenPointRating = (rating?: number): RatingRecommendation =>
    getRecommendation(rating == null ? undefined : rating * 10)

/** i18n key of a level label — translate it in the component. */
export const recommendationKey = (recommendation: RatingRecommendation) => `Rating.${recommendation}`
