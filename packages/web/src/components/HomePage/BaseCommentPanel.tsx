import React from 'react'
import { Comment, Game, User, Image } from 'src/graphql/__generated__/typescript-operations'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { format } from 'date-fns-tz'
import { darkTheme } from '../../theme/darkTheme'
import { GameRatingBox, ratingStyles } from '../common/GameRatingBox/GameRatingBox'

import { parseDateTime } from '../../utils/dateUtils'
import { ProfileImage } from '../common/ProfileImage/ProfileImage'
import { GameLink } from '../common/GameLink/GameLink'
import UserLink from '../common/UserLink/UserLink'

export type BaseCommentData = Pick<Comment, 'id' | 'commentAsText' | 'added'> & {
    readonly game: Pick<Game, 'id' | 'name' | 'averageRating' | 'amountOfRatings'>
    readonly user: Pick<User, 'id' | 'name' | 'nickname'> & {
        image?: Pick<Image, 'id'> | null
    }
}

interface Props {
    readonly comment?: BaseCommentData
}

// https://css-tricks.com/line-clampin/
const useStyles = createUseStyles({
    wrapper: {
        height: 170,
        marginBottom: 20,
    },
    text: {
        paddingBottom: 15,
        width: '100%',
        height: 100,
        boxSizing: 'border-box',

        color: darkTheme.textOnLight,
        fontSize: '0.8rem',
        lineHeight: '140%',
        borderRadius: 4,
    },
    textInner: {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflowWrap: 'break-word',
        overflow: 'hidden',
    },
    more: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 100,
        textAlign: 'right',
        background: 'linear-gradient(to right, rgba(239, 239, 239, 0), rgba(239, 239, 239, 1) 70%)',
    },
    row: {
        display: 'flex',
        flexDirection: 'row',
        color: darkTheme.textDark,
        fontSize: '0.8rem',
        paddingLeft: 15,
        marginBottom: 15,
        background: darkTheme.backgroundWhite,
        paddingTop: 6,
        paddingBottom: 6,
    },
    textRow: {
        display: 'flex',
        whiteSpace: 'nowrap',
        alignItems: 'center',
        lineHeight: '150%',
    },
    link: {
        color: darkTheme.textGreenDark,

        '&:hover': {
            color: darkTheme.textOnLight,
        },
    },
    textWrapper: {
        minWidth: 0,
    },
    date: {
        color: darkTheme.text,
        fontSize: '0.7rem',
    },
    gameName: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 0,
        flexShrink: 1,
    },
    rating: {
        marginRight: 5,
    },
    ...ratingStyles,
})

export const BaseCommentPanel = ({ comment }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const added = format(parseDateTime(comment?.added) || 0, 'dd.MM.yyyy')

    return (
        <div className={classes.wrapper}>
            <div className={classes.row}>
                <ProfileImage userId={comment?.user.id} imageId={comment?.user?.image?.id} />
                {comment && (
                    <div className={classes.textWrapper}>
                        <div className={classes.textRow}>
                            <UserLink userId={comment.user.id} className={classes.link}>
                                {comment.user.name}
                            </UserLink>
                            &nbsp;
                            {t('HomePage.commentAbout')}
                        </div>
                        <div className={classes.textRow}>
                            <GameRatingBox
                                amountOfRatings={comment?.game?.amountOfRatings || 0}
                                rating={comment?.game?.averageRating}
                                className={classes.rating}
                                size="tiny"
                            />
                            <GameLink game={comment.game} className={classNames(classes.gameName, classes.link)}>
                                {comment.game.name}
                            </GameLink>
                        </div>
                        <div className={classes.date}>{added}</div>
                    </div>
                )}
            </div>
            <div className={classes.text}>
                <div className={classes.textInner}>
                    {comment?.commentAsText}
                    {comment && (
                        <GameLink game={comment.game} className={classNames(classes.more, classes.link)}>
                            {t('HomePage.commentMore')}
                        </GameLink>
                    )}
                </div>
            </div>
        </div>
    )
}
