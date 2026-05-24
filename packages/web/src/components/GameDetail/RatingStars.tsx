import React, { useEffect, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import {
    UpdateGameRatingMutation,
    UpdateGameRatingMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import { IconStar } from '../common/Icons/Icons'
import { getRatingGrade } from '../../utils/ratingUtils'

const updateGameRatingGql = require('./graphql/updateGameRating.graphql')

interface Props {
    readonly gameId: string
    readonly rating: number
}

const useStylesStar = createUseStyles({
    button: {
        display: 'inline-block',
        backgroundColor: 'transparent',
        color: darkTheme.backgroundControl,
        fontSize: '1.2rem',
        border: 0,
        padding: 0,
        margin: '8px 2px 2px',
    },
    active: {
        color: darkTheme.text,
    },
    hoverMediocre: {
        '&:hover': {
            color: darkTheme.ratingMediocre,
        },
    },
    hoverAverage: {
        '&:hover': {
            color: darkTheme.ratingAverage,
        },
    },
    hoverGreat: {
        '&:hover': {
            color: darkTheme.ratingGreat,
        },
    },
})

const useStyles = createUseStyles({
    wrapper: {
        fontSize: '0.75rem',
        color: darkTheme.text,
    },
})

interface StarProps {
    readonly rating: number
    readonly currentRating: number
    readonly onChange: (newRating: number) => void
}

const Star = ({ rating, currentRating, onChange }: StarProps) => {
    const classes = useStylesStar()

    const ratingGrade = getRatingGrade(rating * 10)

    return (
        <button
            type="button"
            className={classNames({
                [classes.button]: true,
                [classes.active]: rating <= currentRating,
                [classes.hoverMediocre]: ratingGrade === 'mediocre',
                [classes.hoverAverage]: ratingGrade === 'average',
                [classes.hoverGreat]: ratingGrade === 'great',
            })}
            onClick={() => onChange(rating)}
        >
            <IconStar />
        </button>
    )
}

const RatingStars = ({ gameId, rating }: Props) => {
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

    const array: number[] = []
    for (let i = 1; i <= 10; i += 1) {
        array.push(i)
    }

    return (
        <div className={classes.wrapper}>
            {t('GameDetail.rate')}
            <br />
            {array.map(value => (
                <Star key={value} rating={value} currentRating={currentRating} onChange={handleChange} />
            ))}
        </div>
    )
}

export default RatingStars
