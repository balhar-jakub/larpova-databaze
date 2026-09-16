import React from 'react'
import { createUseStyles } from 'react-jss'
import classnames from 'classnames'
import { darkTheme } from 'src/theme/darkTheme'
import { getRecommendationForGame, gradeForRecommendation, recommendationKey } from 'src/utils/ratingUtils'
import { useTranslation } from 'src/lib/i18n'
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
        textAlign: 'center',
        color: darkTheme.textLight,
    },
    ratingTiny: {
        width: 11,
        height: 11,
        borderRadius: 2,
    },
    ratingSmall: {
        fontSize: '0.7rem',
        minWidth: 40,
        minHeight: 40,
        padding: '0 6px',
    },
    ratingMedium: {
        fontSize: '0.9rem',
        minHeight: 48,
        padding: '0 10px',
    },
    ratingBig: {
        fontSize: '1.5rem',
        minHeight: 100,
        fontWeight: 'unset',
        padding: '0 24px',
    },
    ...ratingStyles,
})

/**
 * Shows a game's standing as a recommendation label (Doporučuji / Neutrální /
 * Nedoporučuji) instead of rating points. The background colour follows the
 * same band. `tiny` renders just the colour, for inline use next to a game link.
 */
export const GameRatingBox = ({ rating, averageRating, amountOfRatings, size = 'small', className }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const recommendation = getRecommendationForGame(amountOfRatings, averageRating || rating)
    const ratingGrade = gradeForRecommendation[recommendation]
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

    return (
        <div className={classnames(classNames)} data-testid={componentTestIds.gameRatingBox.wrapper}>
            {size !== 'tiny' && <span>{t(recommendationKey(recommendation))}</span>}
        </div>
    )
}
