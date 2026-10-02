import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'
import { CalendarEventDataFragment } from '../../graphql/__generated__/typescript-operations'
import CalendarEventCard from './CalendarEventCard'
import { eventSpan, formatShortRange, freeWeekends, groupEventsByWeek, relativeHint } from './calendarUtils'

interface Props {
    readonly events: CalendarEventDataFragment[]
    readonly today: Date
    /** Free weekends are listed until this date. */
    readonly until: Date
    readonly nextEventId?: string
}

const useStyles = createUseStyles({
    block: {
        marginBottom: 10,
    },
    head: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap',
        padding: '4px 0 6px',
    },
    range: {
        fontSize: '0.95rem',
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
    },
    hint: {
        fontSize: '0.72rem',
        fontWeight: 700,
        color: darkTheme.textGreenDark,
    },
    hintCalm: {
        color: darkTheme.textOnLightLighter,
        fontWeight: 400,
    },
    body: {
        borderLeft: `2px solid ${darkTheme.backgroundAlmostNearWhite}`,
        paddingLeft: 14,
    },
    free: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '5px 0',
        marginBottom: 6,
        borderBottom: `1px dashed ${darkTheme.backgroundAlmostNearWhite}`,
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
    },
    freeRange: {
        color: darkTheme.textOnLight,
        fontWeight: 600,
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        body: {
            paddingLeft: 8,
        },
    },
})

/**
 * The default view: the calendar read as a series of weekends, because that is
 * what it is — 27 of the 29 upcoming events start on a Thursday, Friday or
 * Saturday. A margin note states how far away each block is, and runs of empty
 * weekends collapse into a single muted row so the rhythm stays visible without
 * a screen full of nothing.
 */
const WeekendAgenda = ({ events, today, until, nextEventId }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const blocks = groupEventsByWeek(events)
    const free = freeWeekends(events, today, until)

    const freeBetween = (from: Date, to?: Date) =>
        free.filter(
            (weekend) =>
                weekend.saturday.getTime() > from.getTime() &&
                (to === undefined || weekend.saturday.getTime() < to.getTime()),
        )

    const freeRow = (weekends: typeof free, key: string) => {
        if (weekends.length === 0) return null
        const first = weekends[0]
        const last = weekends[weekends.length - 1]

        return (
            <div className={classes.free} key={key} data-testid="calendar.freeWeekend">
                <span className={classes.freeRange}>
                    {weekends.length === 1
                        ? formatShortRange(t, first.saturday, first.sunday)
                        : `${formatShortRange(t, first.saturday, first.sunday)} – ${formatShortRange(
                              t,
                              last.saturday,
                              last.sunday,
                          )}`}
                </span>
                <span>
                    {weekends.length === 1
                        ? t('Calendar.freeWeekend')
                        : t('Calendar.freeWeekends', { count: weekends.length })}
                </span>
            </div>
        )
    }

    const rows: React.ReactNode[] = []

    blocks.forEach((block, index) => {
        const nextBlock = blocks[index + 1]
        const span = eventSpan(block.events[0])

        rows.push(
            <div className={classes.block} key={block.key}>
                <div className={classes.head}>
                    <span className={classes.range} data-testid={`calendar.block.${block.key}`}>
                        {formatShortRange(t, block.from, block.to)}
                    </span>
                    {span && (
                        <span className={`${classes.hint} ${nextBlock ? classes.hintCalm : ''}`}>
                            {relativeHint(t, span, today)}
                        </span>
                    )}
                    <span className={`${classes.hint} ${classes.hintCalm}`}>
                        {t('Calendar.weekendCount', { count: block.events.length })}
                    </span>
                </div>
                <div className={classes.body}>
                    {block.events.map((event) => (
                        <CalendarEventCard key={event.id} event={event} isNext={event.id === nextEventId} />
                    ))}
                </div>
            </div>,
        )

        rows.push(freeRow(freeBetween(block.to, nextBlock?.from), `${block.key}-free`))
    })

    const lastBlock = blocks[blocks.length - 1]
    if (lastBlock) {
        rows.push(freeRow(freeBetween(lastBlock.to), `${lastBlock.key}-free-after`))
    }

    return <div data-testid="calendar.weekendAgenda">{rows}</div>
}

export default WeekendAgenda
