import React from 'react'
import { createUseStyles } from 'react-jss'
import classnames from 'classnames'
import { darkTheme } from 'src/theme/darkTheme'
import {
    getRecommendationForGame,
    gradeForRecommendation,
    RatingRecommendation,
    recommendationKey,
} from 'src/utils/ratingUtils'
import { useTranslation } from 'src/lib/i18n'
import { IconNotRated, IconThumbDown, IconThumbSideways, IconThumbUp } from '../Icons/Icons'
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
    // Fixed squares: the box holds one icon, so it never has to grow to fit a
    // label. The font size drives the FontAwesome SVG size (icons are 1em).
    ratingTiny: {
        width: 11,
        height: 11,
        borderRadius: 2,
    },
    ratingSmall: {
        fontSize: '1.05rem',
        width: 40,
        height: 40,
    },
    ratingMedium: {
        fontSize: '1.35rem',
        width: 48,
        height: 48,
    },
    ratingBig: {
        fontSize: '3rem',
        width: 100,
        height: 100,
    },
    ...ratingStyles,
})

const ICON_BY_RECOMMENDATION: { [key in RatingRecommendation]: React.ComponentType<{ className?: string }> } = {
    notrated: IconNotRated,
    notRecommended: IconThumbDown,
    neutral: IconThumbSideways,
    recommended: IconThumbUp,
}

/**
 * Shows a game's standing as a recommendation icon instead of rating points or
 * a label: thumbs up (recommended), a horizontal thumb (neutral band) and
 * thumbs down (not recommended). An icon fits the fixed square at every size,
 * which the label text never did — that is why the translated label is only
 * exposed as the accessible name and the hover title, and never rendered.
 * `tiny` renders just the colour, for inline use next to a game link.
 */
export const GameRatingBox = ({ rating, averageRating, amountOfRatings, size = 'small', className }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const recommendation = getRecommendationForGame(amountOfRatings, averageRating || rating)
    const ratingGrade = gradeForRecommendation[recommendation]
    const RatingIcon = ICON_BY_RECOMMENDATION[recommendation]
    const label = t(recommendationKey(recommendation))
    const decorative = size === 'tiny'
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
        <div
            className={classnames(classNames)}
            data-testid={componentTestIds.gameRatingBox.wrapper}
            title={decorative ? undefined : label}
            aria-label={decorative ? undefined : label}
            role={decorative ? undefined : 'img'}
        >
            {!decorative && <RatingIcon />}
        </div>
    )
}
