import React, { useContext, useState } from 'react'

import { Game, Rating, User } from 'src/graphql/__generated__/typescript-operations'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { Maybe } from 'graphql/jsutils/Maybe'
import { Col, Row } from 'react-bootstrap'
import { darkTheme } from '../../theme/darkTheme'
import { GameRatingBox, ratingStyles } from '../common/GameRatingBox/GameRatingBox'
import { IconUser } from '../common/Icons/Icons'
import { getRatingForGame, MIN_NUM_RATINGS } from '../../utils/ratingUtils'
import { useLoggedInUser } from '../../hooks/useLoggedInUser'
import RatingStateButtons from './RatingStateButtons'
import RatingStars from './RatingStars'
import AuthorWarningPanel from './AuthorWarningPanel'
import { InPlaceSignInContext } from '../../context/InPlaceSignInContext/InPlaceSignInContext'

interface Props {
    readonly game: Pick<Game, 'id' | 'averageRating' | 'amountOfRatings' | 'ratingStats' | 'ratingsDisabled'> & {
        currentUsersRating?: Maybe<Pick<Rating, 'rating' | 'state'>>
        authors: Array<Pick<User, 'id'>>
    }
}

const useStyles = createUseStyles({
    wrapper: {
        color: darkTheme.text,
        fontSize: '0.8rem',
        textAlign: 'center',
    },
    left: {
        display: 'flex',
        flexDirection: 'column',
        padding: '0 10px',
        textAlign: 'center',
    },
    right: {
        padding: '0 10px 25px',
    },
    statsRow: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: 10,
    },
    statsNum: {
        width: 20,
        marginRight: 5,
        textAlign: 'right',
    },
    statHolder: {
        width: 170,
        height: 20,
        backgroundColor: darkTheme.backgroundControl,
        borderRadius: 4,
    },
    statGauge: {
        height: '100%',
        borderRadius: 4,
        transition: 'width 0.3s ease-in',
    },
    login: {
        textAlign: 'center',
        marginBottom: 20,
    },
    totalPlayed: {
        margin: '20px 0 10px',
    },
    yourRating: {
        marginBottom: 25,
    },
    ratingsDisabled: {
        fontSize: '0.75rem',
        color: darkTheme.text,
    },
    signInButton: {
        border: 0,
        background: 'transparent',
        color: darkTheme.textGreen,
        padding: '4px 0',

        '&:hover': {
            color: darkTheme.text,
        },
    },
    ...ratingStyles,
})

export const GameRatingPanel = ({
    game: { id: gameId, averageRating, amountOfRatings, ratingStats, currentUsersRating, authors, ratingsDisabled },
}: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const loggedInUser = useLoggedInUser()
    const [selfRatingDismissed, setSelfRatingDismissed] = useState(false)
    const signInContext = useContext(InPlaceSignInContext)

    const max = (ratingStats ?? []).reduce((currentMax, rating) => Math.max(currentMax, rating.count), 0)
    let statsMap = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    if (amountOfRatings >= MIN_NUM_RATINGS) {
        // Compute stats only when we have enough ratings
        statsMap = (ratingStats ?? []).reduce((map, entry) => {
            // eslint-disable-next-line no-param-reassign
            map[10 - entry.rating] = Math.round((entry.count * 100) / max)
            return map
        }, statsMap)
    }

    const ratingNum = currentUsersRating?.rating ?? 0
    const rating = ratingNum || '-'
    const ratingState = currentUsersRating?.state ?? 0
    const currentUserId = loggedInUser?.id
    const isAuthorWarningShown =
        !!currentUserId && authors.map(({ id }) => id).includes(currentUserId) && !selfRatingDismissed

    return (
        <div className={classes.wrapper}>
            <Row>
                <Col xs={5} className={classes.left}>
                    <GameRatingBox amountOfRatings={amountOfRatings} rating={averageRating} size="big" />
                    <span className={classes.totalPlayed}>
                        <IconUser />
                        &nbsp;&nbsp;
                        {t('GameDetail.totalPlayed', { amountOfRatings })}
                    </span>
                    {loggedInUser && (
                        <span className={classes.yourRating}>{t('GameDetail.yourRating', { rating })}</span>
                    )}
                    {loggedInUser && <RatingStateButtons gameId={gameId} state={ratingState} />}
                </Col>
                <Col xs={7} className={classes.right}>
                    {statsMap.map((size, n) => {
                        const ratingGrade = getRatingForGame(999, (10 - n) * 10 - 1)
                        const gaugeClassName = classNames({
                            [classes.statGauge]: true,
                            [classes.ratingNotRated]: ratingGrade === 'notrated',
                            [classes.ratingMediocre]: ratingGrade === 'mediocre',
                            [classes.ratingAverage]: ratingGrade === 'average',
                            [classes.ratingGreat]: ratingGrade === 'great',
                        })

                        return (
                            // eslint-disable-next-line react/no-array-index-key
                            <div className={classes.statsRow} key={`rating_${n}`}>
                                <div className={classes.statsNum}>{10 - n}</div>
                                <div className={classes.statHolder}>
                                    <div className={gaugeClassName} style={{ width: `${size}%` }} />
                                </div>
                            </div>
                        )
                    })}
                </Col>
            </Row>
            {!loggedInUser && (
                <div className={classes.login}>
                    {t('GameDetail.logInToRateBefore')}
                    <button type="button" onClick={() => signInContext.setValue(true)} className={classes.signInButton}>
                        {t('GameDetail.logInToRateButton')}
                    </button>
                    {t('GameDetail.logInToRateAfter')}
                </div>
            )}
            {currentUserId && ratingsDisabled && (
                <div className={classes.ratingsDisabled}>{t('GameDetail.ratingsDisabled')}</div>
            )}
            {currentUserId && !ratingsDisabled && isAuthorWarningShown && (
                <AuthorWarningPanel onDismiss={() => setSelfRatingDismissed(true)} />
            )}
            {currentUserId && !ratingsDisabled && !isAuthorWarningShown && (
                <RatingStars gameId={gameId} rating={ratingNum} />
            )}
        </div>
    )
}
