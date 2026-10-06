import React from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'
import { CalendarEventDataFragment } from '../../graphql/__generated__/typescript-operations'
import EventLink from '../common/EventLink/EventLink'
import { GameLink } from '../common/GameLink/GameLink'
import EventRegistrationLink from '../common/EventRegistrationLink/EventRegistrationLink'
import { isAbsoluteHttpUrl } from '../../utils/urlUtils'
import { eventLabelNames, eventSpan, googleCalendarUrl, isForeignLocation, isInternationalEvent } from './calendarUtils'

interface Props {
    readonly event: CalendarEventDataFragment
    readonly isNext?: boolean
}

const useStyles = createUseStyles({
    card: {
        display: 'grid',
        gridTemplateColumns: '1fr 170px',
        gap: 12,
        alignItems: 'center',
        padding: '9px 12px',
        marginBottom: 7,
        backgroundColor: darkTheme.backgroundRealWhite,
        borderRadius: 5,
        borderLeft: `4px solid transparent`,
    },
    next: {
        borderLeftColor: darkTheme.textGreenDark,
    },
    registrationOpen: {
        boxShadow: `inset 0 0 0 1px ${darkTheme.textGreen}`,
    },
    name: {
        fontSize: '1rem',
        color: darkTheme.textOnLightDark,
        fontWeight: 600,

        '&:hover': {
            color: darkTheme.textGreenDark,
        },
    },
    pills: {
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 5,
        marginLeft: 8,
        verticalAlign: 'middle',
    },
    pill: {
        fontSize: '0.65rem',
        fontWeight: 700,
        borderRadius: 9,
        padding: '2px 8px',
        backgroundColor: darkTheme.backgroundNearWhite,
        color: darkTheme.textOnLight,
    },
    pillNext: {
        backgroundColor: darkTheme.textGreenDark,
        color: darkTheme.backgroundRealWhite,
    },
    pillAway: {
        backgroundColor: darkTheme.blue,
        color: darkTheme.backgroundRealWhite,
    },
    pillRegistration: {
        backgroundColor: darkTheme.textGreen,
        color: '#04262b',
    },
    meta: {
        marginTop: 3,
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
    },
    noPlace: {
        color: darkTheme.red,
        fontStyle: 'italic',
    },
    actions: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
        fontSize: '0.72rem',
    },
    action: {
        color: darkTheme.textGreenDark,

        '&:hover': {
            color: darkTheme.textGreen,
        },
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        card: {
            gridTemplateColumns: '1fr',
        },
        actions: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
        },
    },
})

/**
 * One event, carrying only what the record actually holds: length, place, web
 * and registration. The previous row reserved a line for labels, which 28 of
 * the 29 upcoming events do not have — so every row had a blank line and a
 * missing location vanished without a trace.
 */
const CalendarEventCard = ({ event, isNext = false }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const span = eventSpan(event)
    const labels = eventLabelNames(event)
    const registrationUrl = isAbsoluteHttpUrl(event.registrationUrl) ? event.registrationUrl : undefined
    const calendarUrl = googleCalendarUrl(event)
    const games = event.games ?? []

    return (
        <div
            className={classNames(classes.card, {
                [classes.next]: isNext,
                [classes.registrationOpen]: event.registrationOpen && Boolean(registrationUrl),
            })}
            data-testid={`calendar.event.${event.id}`}
        >
            <div>
                <span className={classes.name}>
                    <EventLink event={event}>{event.name}</EventLink>
                </span>
                <span className={classes.pills}>
                    {isNext && <span className={classNames(classes.pill, classes.pillNext)}>{t('Calendar.next')}</span>}
                    {span && (
                        <span className={classes.pill}>
                            {span.days === 1
                                ? t('Calendar.oneDay')
                                : span.days <= 4
                                ? t('Calendar.days', { count: span.days })
                                : t('Calendar.daysLong', { count: span.days })}
                        </span>
                    )}
                    {isForeignLocation(event.loc) && (
                        <span className={classNames(classes.pill, classes.pillAway)}>{t('Calendar.foreign')}</span>
                    )}
                    {isInternationalEvent(event.name) && (
                        <span className={classNames(classes.pill, classes.pillAway)}>
                            {t('Calendar.international')}
                        </span>
                    )}
                    {event.registrationOpen && registrationUrl && (
                        <span className={classNames(classes.pill, classes.pillRegistration)}>
                            {t('Calendar.registrationOpenPill')}
                        </span>
                    )}
                </span>
                <div className={classes.meta}>
                    {event.loc ? (
                        event.loc
                    ) : (
                        <span className={classes.noPlace}>{t('Calendar.noPlace')}</span>
                    )}
                    {labels.length > 0 && ` · ${labels.join(', ')}`}
                    {event.amountOfPlayers ? ` · ${t('Calendar.players', { count: event.amountOfPlayers })}` : ''}
                    {games.length > 0 && (
                        <>
                            {' · '}
                            {t('Calendar.game')}{' '}
                            {games.map((game, index) => (
                                <React.Fragment key={game.id}>
                                    {index > 0 && ', '}
                                    <GameLink game={game} className={classes.action}>
                                        {game.name}
                                    </GameLink>
                                </React.Fragment>
                            ))}
                        </>
                    )}
                </div>
            </div>
            <div className={classes.actions}>
                {event.web && (
                    <a href={event.web} target="_blank" rel="noreferrer" className={classes.action}>
                        {t('Calendar.web')}
                    </a>
                )}
                <EventRegistrationLink url={registrationUrl} open={event.registrationOpen} />
                {calendarUrl && (
                    <a
                        href={calendarUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={classes.action}
                        data-testid={`calendar.addToCalendar.${event.id}`}
                    >
                        {t('Calendar.addToCalendar')}
                    </a>
                )}
            </div>
        </div>
    )
}

export default CalendarEventCard
