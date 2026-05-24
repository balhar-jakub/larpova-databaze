import React, { useMemo, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { format } from 'date-fns-tz'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { Comment, Game, Image, User } from '../../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../../theme/darkTheme'
import { ProfileImage } from '../ProfileImage/ProfileImage'
import { parseDateTime } from '../../../utils/dateUtils'
import { GameRatingBox } from '../GameRatingBox/GameRatingBox'
import { GameLink } from '../GameLink/GameLink'
import UserLink from '../UserLink/UserLink'
import { IconEye } from '../Icons/Icons'
import { sanitizeHtml } from '../../../utils/sanitizeHtml'

interface Props {
    readonly comment: Pick<Comment, 'id' | 'comment' | 'added' | 'amountOfUpvotes' | 'isHidden'> & {
        readonly user: Pick<User, 'id' | 'nickname' | 'name'> & {
            readonly image?: Pick<Image, 'id'> | null
        }
        readonly game?: Pick<Game, 'id' | 'name' | 'averageRating' | 'amountOfRatings'>
    }
    readonly loading?: boolean
    readonly showVisibilityButton: boolean
    readonly onChangeCommentVisibility: (commentId: string, isHidden: boolean) => void
}

const useStyles = createUseStyles({
    wrapper: {
        borderBottom: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        padding: '10px 0',
        color: darkTheme.textOnLightDark,
    },
    dimmed: {
        opacity: 0.5,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        overflow: 'hidden',
    },
    headerUser: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '10px',
    },
    headerMiddle: {
        lineHeight: '180%',
        color: darkTheme.text,
        fontSize: '0.75rem',
    },
    headerNameWrapper: {
        display: 'block',
        borderRadius: 3,
        backgroundColor: darkTheme.backgroundWhite,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
    },
    headerNickName: {
        padding: '3px 5px',
        fontWeight: 700,
        backgroundColor: darkTheme.textGreen,
        color: darkTheme.textLight,
        fontSize: '0.9rem',
    },
    headerName: {
        padding: '3px 5px',
        fontWeight: 700,
        color: darkTheme.textDark,
        fontSize: '0.70rem',
    },
    text: {
        margin: '0 0 10px',
        fontSize: '0.75rem',
    },
    headerLikes: {
        flexGrow: 1,
        fontSize: '1rem',
        alignSelf: 'flex-start',
        color: darkTheme.textDark,
        height: '100%',
        textAlign: 'right',
    },
    commentHiddenButton: {
        display: 'inline-block',
        minWidth: 30,
        height: 30,
        textAlign: 'center',
        paddingTop: 3,
        borderRadius: 15,
        padding: 5,
        marginRight: 8,
        border: 0,
        backgroundColor: darkTheme.backgroundWhite,
        color: darkTheme.textOnLight,
        '&:hover': {
            backgroundColor: darkTheme.textGreen,
            color: darkTheme.textOnLight,
        },
    },
    commentHiddenButtonActive: {
        backgroundColor: darkTheme.backgroundControl,
        color: darkTheme.text,
    },
    likesCircle: {
        display: 'inline-block',
        textAlign: 'center',
        minWidth: 30,
        height: 30,
        paddingTop: 3,
        borderRadius: 15,
        padding: 5,
        backgroundColor: darkTheme.backgroundWhite,
        color: darkTheme.textOnLight,
    },
    game: {
        display: 'flex',
        fontSize: '0.75rem',
        alignItems: 'center',
    },
    rating: {
        margin: '0 5px',
    },
    gameName: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 0,
        flexShrink: 1,
        color: darkTheme.textGreenDark,

        '&:hover': {
            color: darkTheme.textOnLight,
        },
    },
})

const firstWordOf = (name: string) => {
    const sidx = name.indexOf(' ')
    return sidx < 0 ? name : name.substr(0, sidx)
}

const GameCommentPanel = ({ comment, loading, showVisibilityButton, onChangeCommentVisibility }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const added = format(parseDateTime(comment.added) || 0, 'dd.MM.yyyy')
    const [visibilityButtonActive, setVisibilityButtonActive] = useState(comment.isHidden)

    const { nickname, name } = comment.user
    const { game, comment: commentHtml } = comment
    const sanitizedCommentHtml = useMemo(() => sanitizeHtml(commentHtml), [commentHtml])

    const handleToggleVisibility = () => {
        setVisibilityButtonActive(!visibilityButtonActive)
        onChangeCommentVisibility(comment.id, !comment.isHidden)
    }

    return (
        <div className={classNames(classes.wrapper, loading && classes.dimmed)}>
            <div className={classes.header}>
                <div className={classes.headerUser}>
                    <ProfileImage userId={comment.user.id} imageId={comment.user.image?.id} />
                    <div className={classes.headerMiddle}>
                        <UserLink userId={comment.user.id} className={classes.headerNameWrapper}>
                            <span className={classes.headerNickName}>{nickname || firstWordOf(name)}</span>
                            <span className={classes.headerName}>{name}</span>
                        </UserLink>
                        {added}
                    </div>
                </div>
                <div className={classes.headerLikes}>
                    {showVisibilityButton && (
                        <button
                            type="button"
                            className={classNames({
                                [classes.commentHiddenButton]: true,
                                [classes.commentHiddenButtonActive]: visibilityButtonActive,
                            })}
                            onClick={handleToggleVisibility}
                        >
                            <IconEye />
                        </button>
                    )}
                    <div className={classes.likesCircle}>{comment.amountOfUpvotes}</div>
                </div>
            </div>
            {/* eslint-disable-next-line react/no-danger */}
            <p className={classes.text} dangerouslySetInnerHTML={{ __html: sanitizedCommentHtml }} />
            {game && (
                <div className={classes.game}>
                    {t('Game.aboutGame')}
                    <GameRatingBox
                        amountOfRatings={game.amountOfRatings || 0}
                        rating={game.averageRating}
                        className={classes.rating}
                        size="tiny"
                    />
                    <GameLink game={game} className={classes.gameName}>
                        {game.name}
                    </GameLink>
                </div>
            )}
        </div>
    )
}

export default GameCommentPanel
