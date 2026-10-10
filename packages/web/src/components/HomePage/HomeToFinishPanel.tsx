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

interface PersonalGame {
    readonly game?: GameBaseData
    readonly since?: string | null
}

interface Props {
    readonly toRate?: PersonalGame[]
    readonly toComment?: PersonalGame[]
    readonly oldestWanted?: PersonalGame[]
    readonly wantedCount?: number
}

const useStyles = createUseStyles({
    card: {
        display: 'block',
        backgroundColor: darkTheme.backgroundLight,
        borderRadius: 4,
        padding: 15,
        marginBottom: 10,
    },
    game: {
        display: 'block',
        color: darkTheme.text,
        fontSize: '0.82rem',
        fontWeight: 700,
        marginBottom: 5,
    },
    text: {
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        margin: '0 0 8px',
    },
    action: {
        color: darkTheme.textGreen,
        fontSize: '0.72rem',
    },
    item: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        backgroundColor: darkTheme.backgroundLight,
        borderRadius: 4,
        padding: 15,
        marginBottom: 10,
    },
    itemNumber: {
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        fontWeight: 700,
        flexShrink: 0,
    },
    itemBody: {
        flexGrow: 1,
        minWidth: 0,
    },
    itemGame: {
        color: darkTheme.text,
        fontSize: '0.8rem',
        fontWeight: 700,
    },
    itemText: {
        color: darkTheme.textDark,
        fontSize: '0.7rem',
        marginTop: 2,
    },
    itemAction: {
        color: darkTheme.textGreen,
        fontSize: '0.72rem',
        flexShrink: 0,
        whiteSpace: 'nowrap',
    },
    wantedNote: {
        color: darkTheme.textDark,
        fontSize: '0.7rem',
        margin: '8px 0 0',
    },
    wantedLink: {
        color: darkTheme.textGreen,
        fontSize: '0.7rem',
    },
})

/**
 * "Your vote is missing": the games the visitor left half-done, every row about
 * the missing voice — a played game without the rating ("Ohodnotit") and a
 * rated game without the review ("Dopsat recenzi"). Rated-but-unreviewed is
 * three times more common in the database than played-but-unrated, so without
 * the second list the block would hide the bigger half of the work. The
 * "want to play" list is not work — it stays a one-line link to the profile.
 */
export const HomeToFinishPanel = ({ toRate = [], toComment = [], oldestWanted = [], wantedCount }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const wantedSince = oldestWanted[0]?.since ? parseDateTime(oldestWanted[0].since) : null

    const items = [
        ...toRate.map((row, index) => ({
            key: `rate-${row.game?.id ?? index}`,
            game: row.game,
            text: t('HomePage.toFinishPlayed', {
                when: row.since ? format(parseDateTime(row.since) || 0, 'dd.MM.yyyy') : '',
            }),
            action: t('HomePage.toFinishRate'),
        })),
        ...toComment.map((row, index) => ({
            key: `comment-${row.game?.id ?? index}`,
            game: row.game,
            text: t('HomePage.toFinishCommented'),
            action: t('HomePage.toFinishReview'),
        })),
    ]

    return (
        <Col xl={6}>
            <GridHeader>
                {items.length > 0
                    ? t('HomePage.toFinishVoice', { count: items.length })
                    : t('HomePage.toFinish')}
            </GridHeader>
            {items.map((item, index) =>
                item.game ? (
                    <div className={classes.item} key={item.key}>
                        <span className={classes.itemNumber}>{index + 1}.</span>
                        <span className={classes.itemBody}>
                            <GameLink game={item.game} className={classes.itemGame}>{item.game.name}</GameLink>
                            <div className={classes.itemText}>{item.text}</div>
                        </span>
                        <GameLink game={item.game} className={classes.itemAction}>{item.action}</GameLink>
                    </div>
                ) : null,
            )}
            {wantedCount != null && wantedCount > 0 && (
                <p className={classes.wantedNote}>
                    {t('HomePage.toFinishWantedShort', { count: wantedCount })}
                    {wantedSince ? ` ${t('HomePage.toFinishOldest', { year: format(wantedSince, 'yyyy') })}` : ''}
                    {' '}
                    <Link href="/profile/current" legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.wantedLink} href="/profile/current">{t('HomePage.toFinishOpenProfile')}</a>
                    </Link>
                </p>
            )}
        </Col>
    )
}
