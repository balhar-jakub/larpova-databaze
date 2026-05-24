export const MIN_NUM_RATINGS = 5

export const getRatingGrade = (rating?: number) => {
    if (!rating) {
        return 'notrated'
    }
    if (rating < 40) {
        return 'mediocre'
    }
    if (rating < 70) {
        return 'average'
    }
    return 'great'
}

export const getRatingForGame = (amountOfRatings: number, rating?: number) =>
    amountOfRatings < MIN_NUM_RATINGS ? getRatingGrade() : getRatingGrade(rating)
