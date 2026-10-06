import React from 'react'
import { createUseStyles } from 'react-jss'
import classnames from 'classnames'
import { darkTheme } from 'src/theme/darkTheme'
import { getRecommendationForGame, RatingRecommendation, recommendationKey } from 'src/utils/ratingUtils'
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

/**
 * Level colours — the badge fill, the bars in the game detail and the selected
 * button in the input all take their colour from here, so one level never looks
 * like two different things.
 */
export const ratingStyles = {
    ratingNotRated: {
        backgroundColor: darkTheme.ratingNotRated,
    },
    ratingStronglyNotRecommended: {
        backgroundColor: darkTheme.ratingStronglyNotRecommended,
    },
    ratingNotRecommended: {
        backgroundColor: darkTheme.ratingNotRecommended,
    },
    ratingNeutral: {
        backgroundColor: darkTheme.ratingNeutral,
    },
    ratingRecommended: {
        backgroundColor: darkTheme.ratingRecommended,
    },
    ratingStronglyRecommended: {
        backgroundColor: darkTheme.ratingStronglyRecommended,
    },
}

/** Style key that carries the colour of a level — index into ratingStyles. */
export const bandClassName: { [key in RatingRecommendation]: keyof typeof ratingStyles } = {
    notrated: 'ratingNotRated',
    stronglyNotRecommended: 'ratingStronglyNotRecommended',
    notRecommended: 'ratingNotRecommended',
    neutral: 'ratingNeutral',
    recommended: 'ratingRecommended',
    stronglyRecommended: 'ratingStronglyRecommended',
}

/** The glyph of a level: one thumb for the positive pair, one for the negative. */
export const ratingIcon: { [key in RatingRecommendation]: React.ComponentType<{ className?: string }> } = {
    notrated: IconNotRated,
    stronglyNotRecommended: IconThumbDown,
    notRecommended: IconThumbDown,
    neutral: IconThumbSideways,
    recommended: IconThumbUp,
    stronglyRecommended: IconThumbUp,
}

/**
 * The two "spíše" levels are drawn as an outlined square instead of a filled one
 * — that is what separates "doporučuji" from "silně doporučuji" at badge size,
 * where the label never fits. The extremes and the middle keep the filled square
 * they have always had.
 */
const outlinedStyles = {
    ratingRecommendedOutline: {
        backgroundColor: 'transparent',
        border: `2px solid ${darkTheme.ratingRecommended}`,
        color: darkTheme.ratingRecommended,
    },
    ratingNotRecommendedOutline: {
        backgroundColor: 'transparent',
        border: `2px solid ${darkTheme.ratingNotRecommended}`,
        color: darkTheme.ratingNotRecommended,
    },
}

const OUTLINED: Partial<{ [key in RatingRecommendation]: keyof typeof outlinedStyles }> = {
    recommended: 'ratingRecommendedOutline',
    notRecommended: 'ratingNotRecommendedOutline',
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
    ...outlinedStyles,
    ...ratingStyles,
})

/**
 * Shows a game's standing as a recommendation icon instead of rating points or
 * a label: thumbs up for both "doporučuji" levels, a horizontal thumb for the
 * neutral band and thumbs down for both "nedoporučuji" levels — how strong the
 * verdict is carries the fill: an outlined square is the weaker of a pair.
 * An icon fits the fixed square at every size, which the label text never did,
 * so the translated label is only the accessible name and the hover title.
 * `tiny` renders just the colour, for inline use next to a game link: 11 px has
 * no room for an outline, so there the colour alone carries the level.
 */
export const GameRatingBox = ({ rating, averageRating, amountOfRatings, size = 'small', className }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const recommendation = getRecommendationForGame(amountOfRatings, averageRating || rating)
    const RatingIcon = ratingIcon[recommendation]
    const label = t(recommendationKey(recommendation))
    const decorative = size === 'tiny'
    const outlineKey = decorative ? undefined : OUTLINED[recommendation]
    const colourClass = classes[outlineKey ?? bandClassName[recommendation]]
    const classNames = {
        [classes.rating]: true,
        [classes.ratingTiny]: size === 'tiny',
        [classes.ratingSmall]: size === 'small',
        [classes.ratingMedium]: size === 'medium',
        [classes.ratingBig]: size === 'big',
        [className || '_']: !!className,
        [colourClass]: true,
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
