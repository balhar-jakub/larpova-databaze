import React from 'react'
import { createUseStyles } from 'react-jss'
import classnames from 'classnames'
import { darkTheme } from 'src/theme/darkTheme'
import { getRatingForGame, MIN_NUM_RATINGS } from 'src/utils/ratingUtils'
import { componentTestIds } from '../../componentTestIds'

interface Props {
    readonly rating?: number
    readonly averageRating?: number
    readonly amountOfRatings: number
    readonly className?: string
    readonly size?: 'tiny' | 'small' | 'medium' | 'big'
}

export const ratingStyles = {
    ratingNotRated: {
        backgroundColor: darkTheme.ratingNotRated,
    },
    ratingMediocre: {
        backgroundColor: darkTheme.ratingMediocre,
    },
    ratingAverage: {
        backgroundColor: darkTheme.ratingAverage,
    },
    ratingGreat: {
        backgroundColor: darkTheme.ratingGreat,
    },
}

const useStyles = createUseStyles({
    rating: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        fontWeight: 700,
        flexShrink: 0,
        color: darkTheme.textLight,
    },
    ratingTiny: {
        width: 11,
        height: 11,
        borderRadius: 2,
    },
    ratingSmall: {
        fontSize: '0.7rem',
        width: 40,
        height: 40,
    },
    ratingMedium: {
        fontSize: '1.1rem',
        height: 48,
    },
    ratingBig: {
        fontSize: '2.75rem',
        height: 100,
        fontWeight: 'unset',
    },
    average: {
        fontSize: '60%',
    },
    ...ratingStyles,
})

export const GameRatingBox = ({ rating, averageRating, amountOfRatings, size = 'small', className }: Props) => {
    const classes = useStyles()

    const ratingGrade = getRatingForGame(amountOfRatings, averageRating || rating)
    const classNames = {
        [classes.rating]: true,
        [classes.ratingTiny]: size === 'tiny',
        [classes.ratingSmall]: size === 'small',
        [classes.ratingMedium]: size === 'medium',
        [classes.ratingBig]: size === 'big',
        [className || '_']: !!className,
        [classes.ratingNotRated]: ratingGrade === 'notrated',
        [classes.ratingMediocre]: ratingGrade === 'mediocre',
        [classes.ratingAverage]: ratingGrade === 'average',
        [classes.ratingGreat]: ratingGrade === 'great',
    }
    const hasEnoughRatings = amountOfRatings >= MIN_NUM_RATINGS
    const clippedRating = hasEnoughRatings ? rating : 0

    return (
        <div className={classnames(classNames)} data-testid={componentTestIds.gameRatingBox.wrapper}>
            <span>
                {size !== 'tiny' && (clippedRating ? (clippedRating / 10).toFixed(1) : '-')}
                {size !== 'tiny' && hasEnoughRatings && averageRating !== undefined && (
                    <span className={classes.average}>
                        {' / ∅ '}
                        {(averageRating / 10).toFixed(1)}
                    </span>
                )}
            </span>
        </div>
    )
}
