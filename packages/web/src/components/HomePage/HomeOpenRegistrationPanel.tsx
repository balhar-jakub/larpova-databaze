import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col } from 'react-bootstrap'
import Link from 'next/link'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { formatTimeRange } from '../../utils/dateUtils'
import { EventBaseData } from './EventBaseDataPanel'
import EventLink from '../common/EventLink/EventLink'
import EventRegistrationLink from '../common/EventRegistrationLink/EventRegistrationLink'
import { GridHeader } from './GridHeader'
import { componentTestIds } from '../componentTestIds'

interface Props {
    readonly events?: (OpenRegistrationEvent | undefined)[]
    readonly href?: string
}

export interface OpenRegistrationEvent extends EventBaseData {
    readonly registrationUrl?: string | null
    readonly registrationOpen: boolean
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
    event: {
        flexGrow: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        color: darkTheme.text,
        fontSize: '0.78rem',
        overflow: 'hidden',
    },
    name: {
        fontWeight: 700,
        color: darkTheme.textGreen,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    bottomLine: {
        display: 'flex',
        alignItems: 'center',
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        overflow: 'hidden',
    },
    date: {
        color: darkTheme.text,
        flexShrink: 0,
    },
    loc: {
        marginLeft: 12,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    registration: {
        flexShrink: 0,
        marginLeft: 12,
    },
    empty: {
        color: darkTheme.textDark,
        fontSize: '0.78rem',
        padding: '10px 0',
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
 * "You can still sign up for these": upcoming events with an open
 * registration, one row per event with the registration link right in the
 * row. The counterpart of the anonymous and empty-state shapes alike.
 *
 * Nothing renders when the list is empty: the community's calendar often
 * has no open registration at all, and an empty block would reopen the hole
 * in the row this panel was added to fill.
 */
export const HomeOpenRegistrationPanel = ({ events, href }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    if (events && events.length === 0) {
        return null
    }

    return (
        <Col xl={6} data-testid={componentTestIds.homeOpenRegistration.panel}>
            <GridHeader>{t('HomePage.openRegistration')}</GridHeader>
            <div className={classes.list}>
                {(events ?? loadingRows).map((event, n) => {
                    if (!event) {
                        return <div className={classes.row} key={`loading_${n}`}>&nbsp;</div>
                    }
                    const { fromFormatted, toFormatted, justOneDate } = formatTimeRange(event.from, event.to)
                    return (
                        <div
                            className={classes.row}
                            key={event.id}
                            data-testid={componentTestIds.homeOpenRegistration.row(event.id)}
                        >
                            <EventLink event={event} className={classes.event}>
                                <span className={classes.name}>{event.name}</span>
                                <span className={classes.bottomLine}>
                                    <span className={classes.date}>
                                        {justOneDate ? fromFormatted : `${fromFormatted} – ${toFormatted}`}
                                    </span>
                                    {event.loc && <span className={classes.loc}>{event.loc}</span>}
                                </span>
                            </EventLink>
                            <EventRegistrationLink
                                url={event.registrationUrl}
                                open={event.registrationOpen}
                                className={classes.registration}
                                onDarkBackground
                            />
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
