import React, { useMemo, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { useTranslation } from 'react-i18next'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import {
    DeleteRatingMutation,
    DeleteRatingMutationVariables,
    Rating,
    User,
} from '../../graphql/__generated__/typescript-operations'
import { DetailListHeader } from '../common/DetailListHeader/DetailListHeader'
import { darkTheme } from '../../theme/darkTheme'
import { IconTrash } from '../common/Icons/Icons'
import UserLink from '../common/UserLink/UserLink'
import { useShowToast } from '../../hooks/useShowToast'

const deleteRatingGql = require('./graphql/deleteRating.graphql')

type LocalRating = Pick<Rating, 'id' | 'rating'> & {
    user: Pick<User, 'id' | 'name'>
}

interface Props {
    readonly gameId: string
    readonly ratings: LocalRating[]
    readonly onRatingDeleted: () => void
}

const useStyles = createUseStyles({
    wrapper: {
        padding: 15,
        marginBottom: 12,
    },
    row: {
        fontSize: '0.75rem',
        color: darkTheme.textOnLight,
    },
    rowDeleted: {
        opacity: 0.3,
    },
    link: {
        color: darkTheme.textGreen,
        border: 0,
        marginLeft: 2,

        '&:hover': {
            color: darkTheme.textOnLight,
        },
    },
})

interface DeletedRatingMap {
    [key: string]: boolean
}

const RatingsListPanel = ({ gameId, ratings, onRatingDeleted }: Props) => {
    const client = useApolloClient()
    const classes = useStyles()
    const { t } = useTranslation('common')
    const showToast = useShowToast()
    const [deletedRatings, setDeletedRatings] = useState<DeletedRatingMap>({})

    const handleDelete = (rating: LocalRating) => async () => {
        setDeletedRatings({ ...deletedRatings, [rating.id]: true })
        await client.mutate<DeleteRatingMutation, DeleteRatingMutationVariables>({
            mutation: deleteRatingGql,
            variables: {
                gameId,
                userId: rating.user.id,
            },
        })
        showToast(t('GameDetail.ratingDeleted'), 'success')
        onRatingDeleted()
    }

    const ratingsSorted = useMemo(() => [...ratings].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)), [ratings])

    return (
        <>
            <DetailListHeader>{t('GameDetail.ratings')}</DetailListHeader>
            <div className={classes.wrapper}>
                {ratingsSorted
                    .filter(rating => !!rating.rating)
                    .map(rating => (
                        <div
                            key={rating.id}
                            className={classNames({
                                [classes.row]: true,
                                [classes.rowDeleted]: deletedRatings[rating.id],
                            })}
                        >
                            {rating.rating}
                            <button
                                type="button"
                                className={classes.link}
                                disabled={deletedRatings[rating.id]}
                                onClick={handleDelete(rating)}
                            >
                                <IconTrash />
                            </button>
                            <UserLink userId={rating.user.id} className={classes.link}>
                                {rating.user.name}
                            </UserLink>
                        </div>
                    ))}
            </div>
        </>
    )
}

export default RatingsListPanel
