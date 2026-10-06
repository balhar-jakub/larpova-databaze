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
import { RATING_BANDS, getRecommendationForTenPointRating, recommendationKey } from '../../utils/ratingUtils'
import { bandClassName, ratingIcon, ratingStyles } from '../common/GameRatingBox/GameRatingBox'

const updateGameRatingGql = require('./graphql/updateGameRating.graphql')

interface Props {
    readonly gameId: string
    readonly rating: number
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
    // The selected button carries the colour of its own level, so the choice
    // reads the same way as the badge next to it.
    ...ratingStyles,
})

/**
 * Picks one of five recommendation levels — from "silně doporučuji" down to
 * "silně nedoporučuji" — and stores the 1-10 value that belongs to the level
 * (see RATING_BANDS). The stored scale is unchanged, so ratings made while the
 * input was ten stars still mean the same thing.
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
            {currentRating ? t('GameDetail.changeRating') : t('GameDetail.rate')}
            <br />
            {RATING_BANDS.map(({ recommendation, storedRating }) => {
                const Icon = ratingIcon[recommendation]
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
                            [classes[bandClassName[recommendation]]]: isSelected,
                        })}
                        onClick={() => handleChange(storedRating)}
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
