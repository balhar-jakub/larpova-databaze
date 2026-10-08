import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col } from 'react-bootstrap'
import Link from 'next/link'
import { format } from 'date-fns-tz'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { parseDateTime } from '../../utils/dateUtils'
import { GameBaseData } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { GameLink } from '../common/GameLink/GameLink'
import { GridHeader } from './GridHeader'

interface AuthoredRow {
    readonly game?: GameBaseData
    readonly lastRating?: {
        readonly rating: number
        readonly added?: string | null
        readonly user?: { readonly id: string; readonly name?: string | null } | null
    } | null
}

interface Props {
    readonly authored?: AuthoredRow[]
    readonly authoredCount?: number
}

const useStyles = createUseStyles({
    head: {
        display: 'flex',
        color: darkTheme.textDark,
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        borderBottom: `1px solid ${darkTheme.backgroundControl}`,
        paddingBottom: 4,
        marginBottom: 4,
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        padding: '5px 0',
    },
    name: {
        flexGrow: 1,
        minWidth: 0,
        color: darkTheme.text,
        fontSize: '0.78rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    rating: {
        width: 46,
        textAlign: 'center',
        color: darkTheme.textGreen,
        fontSize: '0.78rem',
        fontWeight: 700,
        flexShrink: 0,
    },
    ratingNone: {
        color: darkTheme.textDark,
        fontWeight: 400,
    },
    when: {
        width: 86,
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        flexShrink: 0,
    },
    who: {
        width: 110,
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flexShrink: 0,
    },
    more: {
        textAlign: 'center',
        marginTop: 6,
    },
    moreLink: {
        color: darkTheme.textGreen,
        fontSize: '0.72rem',
    },
})

/**
 * The visitor's own games with the newest rating each received. Before this the
 * author had to open every one of their games to find out whether anything had
 * happened — fifteen detail pages for a single answer.
 */
export const HomeAuthoredPanel = ({ authored = [], authoredCount }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={6}>
            <GridHeader>{t('HomePage.authored')}</GridHeader>
            <div className={classes.head}>
                <span className={classes.name}>{t('HomePage.authoredGame')}</span>
                <span className={classes.rating}>{t('HomePage.authoredLastRating')}</span>
                <span className={classes.when}>{t('HomePage.authoredWhen')}</span>
                <span className={classes.who}>{t('HomePage.authoredWho')}</span>
            </div>
            {authored.map((row) =>
                row.game ? (
                    <div className={classes.row} key={row.game.id}>
                        <GameLink game={row.game} className={classes.name}>{row.game.name}</GameLink>
                        <span className={row.lastRating ? classes.rating : `${classes.rating} ${classes.ratingNone}`}>
                            {row.lastRating?.rating ?? '–'}
                        </span>
                        <span className={classes.when}>
                            {row.lastRating?.added ? format(parseDateTime(row.lastRating.added) || 0, 'dd.MM.yyyy') : ''}
                        </span>
                        <span className={classes.who}>{row.lastRating?.user?.name ?? ''}</span>
                    </div>
                ) : null,
            )}
            {authoredCount != null && authoredCount > authored.length && (
                <div className={classes.more}>
                    <Link href="/profile/current" legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.moreLink} href="/profile/current">
                            {t('HomePage.authoredMore', { count: authoredCount - authored.length })}
                        </a>
                    </Link>
                </div>
            )}
        </Col>
    )
}
