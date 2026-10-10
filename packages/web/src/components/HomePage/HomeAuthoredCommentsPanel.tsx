import React from 'react'
import { createUseStyles } from 'react-jss'
import { format } from 'date-fns-tz'
import { Col } from 'react-bootstrap'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { parseDateTime } from '../../utils/dateUtils'
import { GameBaseData } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { GameLink } from '../common/GameLink/GameLink'
import { GridHeader } from './GridHeader'

interface MyHomeComment {
    readonly id: string
    readonly commentAsText?: string | null
    readonly added?: string | null
    readonly user?: {
        readonly name?: string | null
        readonly nickname?: string | null
    } | null
    readonly game?: GameBaseData | null
}

interface Props {
    readonly comments?: MyHomeComment[]
}

const useStyles = createUseStyles({
    comment: {
        backgroundColor: darkTheme.backgroundLight,
        borderRadius: 4,
        padding: '10px 14px',
        marginBottom: 8,
    },
    head: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        flexWrap: 'wrap',
    },
    game: {
        color: darkTheme.text,
        fontSize: '0.78rem',
        fontWeight: 700,
    },
    author: {
        color: darkTheme.textDark,
        fontSize: '0.7rem',
    },
    when: {
        color: darkTheme.textDark,
        fontSize: '0.7rem',
        marginLeft: 'auto',
        flexShrink: 0,
    },
    text: {
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        marginTop: 4,
        // Two lines of an excerpt; the full text is one click away on the game page.
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    },
    none: {
        color: darkTheme.textDark,
        fontSize: '0.78rem',
        textAlign: 'center',
        padding: '10px 0',
    },
})

/**
 * What other people wrote about the visitor's own games — the news an author
 * otherwise learns only by opening every game's page. The excerpt is the same
 * decoded plain text the comment list uses, two lines is enough to decide
 * whether to go and read the rest.
 */
export const HomeAuthoredCommentsPanel = ({ comments = [] }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={6}>
            <GridHeader>{t('HomePage.authoredComments')}</GridHeader>
            {comments.length === 0 && <div className={classes.none}>{t('HomePage.authoredCommentsNone')}</div>}
            {comments.map((comment) => (
                <div className={classes.comment} key={comment.id}>
                    {comment.game && (
                        <div className={classes.head}>
                            <GameLink game={comment.game} className={classes.game}>{comment.game.name}</GameLink>
                            <span className={classes.author}>
                                {t('HomePage.authoredCommentsBy', { name: comment.user?.name ?? '' })}
                            </span>
                            <span className={classes.when}>
                                {comment.added ? format(parseDateTime(comment.added) || 0, 'dd.MM.yyyy') : ''}
                            </span>
                        </div>
                    )}
                    {comment.commentAsText && <p className={classes.text}>{comment.commentAsText}</p>}
                </div>
            ))}
        </Col>
    )
}
