import React, { useContext, useState } from 'react'

import { Game, Rating, User } from 'src/graphql/__generated__/typescript-operations'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import classNames from 'classnames'
import { Maybe } from 'graphql/jsutils/Maybe'
import { Col, Row } from 'react-bootstrap'
import { darkTheme } from '../../theme/darkTheme'
import { GameRatingBox, ratingStyles } from '../common/GameRatingBox/GameRatingBox'
import { IconUser } from '../common/Icons/Icons'
import { getRecommendationForTenPointRating, MIN_NUM_RATINGS, recommendationKey, RatingRecommendation } from '../../utils/ratingUtils'
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
    statsLabel: {
        width: 92,
        marginRight: 5,
        fontSize: '0.7rem',
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

    const countsByRating = new Map<number, number>()
    ;(ratingStats ?? []).forEach(entry => {
        countsByRating.set(entry.rating, (countsByRating.get(entry.rating) ?? 0) + (entry.count ?? 0))
    })
    const totalRatingsCount = (ratingStats ?? []).reduce((sum, entry) => sum + (entry.count ?? 0), 0)
    const hasEnoughRatings = amountOfRatings >= MIN_NUM_RATINGS

    // The chart shows the three recommendation bands instead of rating points.
    const recommendationBandDefinitions: Array<{
        recommendation: RatingRecommendation
        readings: number[]
        className: string
    }> = [
        { recommendation: 'recommended', readings: [8, 9, 10], className: classes.ratingGreat },
        { recommendation: 'neutral', readings: [4, 5, 6, 7], className: classes.ratingAverage },
        { recommendation: 'notRecommended', readings: [1, 2, 3], className: classes.ratingMediocre },
    ]
    const recommendationBands = recommendationBandDefinitions.map(band => ({
        ...band,
        share:
            hasEnoughRatings && totalRatingsCount > 0
                ? Math.round(
                      (band.readings.reduce((sum, value) => sum + (countsByRating.get(value) ?? 0), 0) * 100) /
                          totalRatingsCount,
                  )
                : 0,
    }))

    const ratingNum = currentUsersRating?.rating ?? 0
    const rating = ratingNum ? t(recommendationKey(getRecommendationForTenPointRating(ratingNum))) : '-'
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
                    {recommendationBands.map(band => (
                        <div className={classes.statsRow} key={band.recommendation}>
                            <div className={classes.statsLabel}>{t(recommendationKey(band.recommendation))}</div>
                            <div className={classes.statHolder}>
                                <div
                                    className={classNames(classes.statGauge, band.className)}
                                    style={{ width: `${band.share}%` }}
                                />
                            </div>
                        </div>
                    ))}
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
