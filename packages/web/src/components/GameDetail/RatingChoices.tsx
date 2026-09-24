import React, { useEffect, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { useTranslation } from 'src/lib/i18n'
import {
    UpdateGameRatingMutation,
    UpdateGameRatingMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import { IconThumbDown, IconThumbSideways, IconThumbUp } from '../common/Icons/Icons'
import {
    RATING_CHOICES,
    RatingRecommendation,
    getRecommendationForTenPointRating,
    recommendationKey,
} from '../../utils/ratingUtils'

const updateGameRatingGql = require('./graphql/updateGameRating.graphql')

interface Props {
    readonly gameId: string
    readonly rating: number
}

const ICON_BY_RECOMMENDATION: { [key in RatingRecommendation]: React.ComponentType<{ className?: string }> } = {
    recommended: IconThumbUp,
    neutral: IconThumbSideways,
    notRecommended: IconThumbDown,
    notrated: IconThumbUp, // never rendered — RATING_CHOICES has no `notrated`
}

const useStyles = createUseStyles({
    wrapper: {
        fontSize: '0.75rem',
        color: darkTheme.text,
    },
    button: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        backgroundColor: darkTheme.backgroundControl,
        color: darkTheme.text,
        border: '1px solid #000',
        borderRadius: 4,
        padding: '4px 8px',
        marginRight: 4,
        marginTop: 4,
        cursor: 'pointer',

        '&:hover': {
            backgroundColor: darkTheme.backgroundWhite,
            color: darkTheme.textOnLightDark,
        },
    },
    selected: {
        color: darkTheme.textLight,
        borderColor: darkTheme.textLight,
    },
    // The selected button carries its own band colour, so the choice reads the
    // same way as the badge next to it.
    selectedRecommended: {
        backgroundColor: darkTheme.ratingGreat,
    },
    selectedNeutral: {
        backgroundColor: darkTheme.ratingAverage,
    },
    selectedNotRecommended: {
        backgroundColor: darkTheme.ratingMediocre,
    },
})

/**
 * Picks one of three ratings — thumbs up (Doporučuji), a horizontal thumb
 * (Neutrální) and thumbs down (Nedoporučuji) — and stores the 1-10 value that
 * belongs to the band (see RATING_CHOICES). The stored scale is unchanged, so
 * ratings made while the input was ten stars still mean the same thing.
 */
const RatingChoices = ({ gameId, rating }: Props) => {
    const client = useApolloClient()
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [tmpValue, setTmpValue] = useState<number | undefined>(undefined)

    // Clear tmpValue on rating change
    useEffect(() => {
        setTmpValue(undefined)
    }, [rating, setTmpValue])

    const handleChange = (newRating: number) => {
        if (newRating !== rating) {
            setTmpValue(newRating)
            client.mutate<UpdateGameRatingMutation, UpdateGameRatingMutationVariables>({
                mutation: updateGameRatingGql,
                variables: { gameId, rating: newRating },
            })
        }
    }
    const currentRating = tmpValue !== undefined ? tmpValue : rating
    const currentRecommendation = currentRating ? getRecommendationForTenPointRating(currentRating) : undefined

    return (
        <div className={classes.wrapper}>
            {t('GameDetail.rate')}
            <br />
            {RATING_CHOICES.map(({ recommendation, rating: value }) => {
                const Icon = ICON_BY_RECOMMENDATION[recommendation]
                const label = t(recommendationKey(recommendation))
                const isSelected = currentRecommendation === recommendation

                return (
                    <button
                        key={recommendation}
                        type="button"
                        aria-pressed={isSelected}
                        className={classNames({
                            [classes.button]: true,
                            [classes.selected]: isSelected,
                            [classes.selectedRecommended]: isSelected && recommendation === 'recommended',
                            [classes.selectedNeutral]: isSelected && recommendation === 'neutral',
                            [classes.selectedNotRecommended]: isSelected && recommendation === 'notRecommended',
                        })}
                        onClick={() => handleChange(value)}
                    >
                        <Icon />
                        <span>{label}</span>
                    </button>
                )
            })}
        </div>
    )
}

export default RatingChoices
