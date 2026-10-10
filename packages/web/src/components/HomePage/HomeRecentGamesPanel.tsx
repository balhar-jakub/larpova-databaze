import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col } from 'react-bootstrap'
import Link from 'next/link'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { formatTimeRange } from '../../utils/dateUtils'
import { EventBaseData } from './EventBaseDataPanel'
import { GameBaseData } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { GameLink } from '../common/GameLink/GameLink'
import EventLink from '../common/EventLink/EventLink'
import { GameRatingBox } from '../common/GameRatingBox/GameRatingBox'
import { GridHeader } from './GridHeader'
import { componentTestIds } from '../componentTestIds'

interface RecentRow {
    readonly game?: GameBaseData
    readonly event?: EventBaseData
}

interface Props {
    readonly recent?: RecentRow[]
    readonly href?: string
}

const useStyles = createUseStyles({
    list: {
        display: 'flex',
        flexDirection: 'column',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        padding: '5px 0',
        borderBottom: `1px solid ${darkTheme.backgroundControl}`,
        '&:last-child': {
            borderBottom: 'none',
        },
    },
    link: {
        flexGrow: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        color: darkTheme.text,
        fontSize: '0.78rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    name: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    event: {
        width: 190,
        flexShrink: 0,
        marginLeft: 12,
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'right',
    },
    eventDate: {
        color: darkTheme.text,
    },
    more: {
        textAlign: 'center',
        marginTop: 6,
    },
    moreLink: {
        color: darkTheme.textGreen,
        fontSize: '0.72rem',
        cursor: 'pointer',
    },
})

const loadingRows = [undefined, undefined, undefined, undefined, undefined, undefined]

/**
 * "What is being played right now": games whose latest event is recent, with
 * that event named next to the game. One row per game, newest event first —
 * the community pulse of the last weeks, on the anonymous page and on the
 * empty state alike.
 */
export const HomeRecentGamesPanel = ({ recent = loadingRows, href }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={6} data-testid={componentTestIds.homeRecentGames.panel}>
            <GridHeader>{t('HomePage.recentGames')}</GridHeader>
            <div className={classes.list}>
                {recent.map((row, n) => {
                    if (!row || !row.game || !row.event) {
                        return <div className={classes.row} key={`loading_${n}`}>&nbsp;</div>
                    }
                    const { fromFormatted, toFormatted, justOneDate } = formatTimeRange(row.event.from, row.event.to)
                    return (
                        <div className={classes.row} key={row.game.id} data-testid={componentTestIds.homeRecentGames.row(row.game.id)}>
                            <GameLink game={row.game} className={classes.link}>
                                <GameRatingBox amountOfRatings={row.game.amountOfRatings} rating={row.game.averageRating} size="tiny" />
                                <span className={classes.name}>{row.game.name}</span>
                            </GameLink>
                            <EventLink event={row.event} className={classes.event}>
                                <span className={classes.eventDate}>
                                    {justOneDate ? fromFormatted : `${fromFormatted} – ${toFormatted}`}
                                </span>
                                {' '}
                                {row.event.name}
                            </EventLink>
                        </div>
                    )
                })}
            </div>
            {href && (
                <div className={classes.more}>
                    <Link href={href} legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.moreLink} href={href}>{t('HomePage.seeCalendar')}</a>
                    </Link>
                </div>
            )}
        </Col>
    )
}
