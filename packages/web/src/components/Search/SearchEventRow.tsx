import React from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'
import EventLink from '../common/EventLink/EventLink'
import EventRegistrationLink from '../common/EventRegistrationLink/EventRegistrationLink'
import { GameLink } from '../common/GameLink/GameLink'
import { isAbsoluteHttpUrl } from '../../utils/urlUtils'
import { eventLabelNames, googleCalendarUrl, isForeignLocation, isInternationalEvent } from '../Calendar/calendarUtils'
import { componentTestIds } from '../componentTestIds'
import HighlightedText from './HighlightedText'
import { EventRowData, eventDateLabel, isUpcoming } from './searchHelpers'

interface Props {
    readonly event: EventRowData
    readonly query?: string | null
    /** How many events share this row's name, start and end (1 = unique row). */
    readonly duplicateCount?: number
}

const useStyles = createUseStyles({
    row: {
        display: 'grid',
        gridTemplateColumns: '92px 1fr 150px',
        gap: 12,
        alignItems: 'center',
        background: darkTheme.backgroundRealWhite,
        borderRadius: 6,
        padding: '9px 14px',
        marginBottom: 7,
        color: darkTheme.textOnLightDark,
        borderLeft: '4px solid transparent',
    },
    upcoming: {
        borderLeftColor: darkTheme.textGreenDark,
    },
    /**
     * The calendar card carries no date at all — the day heading above it does.
     * In a search list there is no heading, so 153 events arrived without a
     * single visible date and the 18 rows called "Larpová chata" were
     * indistinguishable.
     */
    date: {
        fontSize: '0.78rem',
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
        background: darkTheme.backgroundNearWhite,
        borderRadius: 4,
        padding: '4px 6px',
        textAlign: 'center',
    },
    body: {
        minWidth: 0,
    },
    name: {
        fontSize: '1rem',
        fontWeight: 600,
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
    pillDuplicate: {
        backgroundColor: '#ffe9b0',
        color: '#5a3d00',
    },
    pillAway: {
        backgroundColor: darkTheme.blue,
        color: darkTheme.backgroundRealWhite,
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
        row: {
            gridTemplateColumns: '1fr',
        },
        date: {
            justifySelf: 'start',
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
 * One event in the search results: the calendar card plus the date and the
 * information that the row stands for a cluster of identical rows (same name,
 * same start, same end).
 */
export const SearchEventRow = ({ event, query, duplicateCount = 0 }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const labels = eventLabelNames(event)
    const registrationUrl = isAbsoluteHttpUrl(event.registrationUrl) ? event.registrationUrl : undefined
    const calendarUrl = googleCalendarUrl(event)
    const games = event.games ?? []
    const upcoming = isUpcoming(event)

    return (
        <div
            className={classNames(classes.row, { [classes.upcoming]: upcoming })}
            data-testid={componentTestIds.search.eventRow(event.id)}
        >
            <div className={classes.date}>{eventDateLabel(event.from, event.to)}</div>
            <div className={classes.body}>
                <span className={classes.name}>
                    <EventLink event={event}>
                        <HighlightedText text={event.name} query={query} />
                    </EventLink>
                </span>
                <span className={classes.pills}>
                    {upcoming && <span className={classNames(classes.pill, classes.pillNext)}>{t('Search.upcomingPill')}</span>}
                    {duplicateCount > 1 && (
                        <span
                            className={classNames(classes.pill, classes.pillDuplicate)}
                            title={t('Search.duplicateHint')}
                            data-testid={componentTestIds.search.duplicateBadge(event.id)}
                        >
                            {t('Search.duplicateRow', { count: duplicateCount })}
                        </span>
                    )}
                    {isForeignLocation(event.loc) && (
                        <span className={classNames(classes.pill, classes.pillAway)}>{t('Calendar.foreign')}</span>
                    )}
                    {isInternationalEvent(event.name) && (
                        <span className={classNames(classes.pill, classes.pillAway)}>{t('Calendar.international')}</span>
                    )}
                </span>
                <div className={classes.meta}>
                    {event.loc ? event.loc : <span className={classes.noPlace}>{t('Calendar.noPlace')}</span>}
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
                                        {game.name ?? ''}
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
                    <a href={calendarUrl} target="_blank" rel="noreferrer" className={classes.action}>
                        {t('Calendar.addToCalendar')}
                    </a>
                )}
            </div>
        </div>
    )
}

export default SearchEventRow
