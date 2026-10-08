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
})

/**
 * "Finish it": the two things the visitor left half-done. Both come from their
 * own rows — a played game without a rating (2 522 such rows in the database,
 * held by 518 people) and the "want to play" list that has been sitting there
 * since 2007. Neither was visible anywhere before this block.
 */
export const HomeToFinishPanel = ({ toRate = [], oldestWanted = [], wantedCount }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const wantedSince = oldestWanted[0]?.since ? parseDateTime(oldestWanted[0].since) : null

    return (
        <Col xl={6}>
            <GridHeader>{t('HomePage.toFinish')}</GridHeader>
            {toRate.map((row) =>
                row.game ? (
                    <div className={classes.card} key={`rate-${row.game.id}`}>
                        <GameLink game={row.game} className={classes.game}>{row.game.name}</GameLink>
                        <p className={classes.text}>
                            {t('HomePage.toFinishPlayed', {
                                when: row.since ? format(parseDateTime(row.since) || 0, 'dd.MM.yyyy') : '',
                            })}
                        </p>
                        <GameLink game={row.game} className={classes.action}>{t('HomePage.toFinishRate')}</GameLink>
                    </div>
                ) : null,
            )}
            {wantedCount != null && wantedCount > 0 && (
                <div className={classes.card}>
                    <p className={classes.text}>
                        {t('HomePage.toFinishWanted', { count: wantedCount })}
                        {wantedSince ? ` ${t('HomePage.toFinishOldest', { year: format(wantedSince, 'yyyy') })}` : ''}
                    </p>
                    <Link href="/profile/current" legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.action} href="/profile/current">{t('HomePage.toFinishOpenProfile')}</a>
                    </Link>
                </div>
            )}
        </Col>
    )
}
