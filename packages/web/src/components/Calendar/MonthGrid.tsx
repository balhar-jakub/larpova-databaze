import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'
import { CalendarEventDataFragment } from '../../graphql/__generated__/typescript-operations'
import { buildMonthGrid, eventSpan, monthName, weekdayShort } from './calendarUtils'

interface Props {
    readonly year: number
    readonly month: number
    readonly events: CalendarEventDataFragment[]
    readonly today: Date
}

const useStyles = createUseStyles({
    grid: {
        backgroundColor: darkTheme.backgroundRealWhite,
        borderRadius: 5,
        padding: 12,
        marginBottom: 14,
    },
    title: {
        margin: '0 0 9px',
        fontSize: '0.95rem',
        color: darkTheme.textOnLightDark,
        fontWeight: 700,
    },
    titleCount: {
        color: darkTheme.textOnLightLighter,
        fontWeight: 400,
        fontSize: '0.75rem',
    },
    week: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2,
        marginBottom: 3,
    },
    dow: {
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        textAlign: 'center',
        color: darkTheme.textOnLightLighter,
    },
    day: {
        minHeight: 22,
        padding: '2px 4px',
        borderRadius: 3,
        backgroundColor: darkTheme.backgroundNearWhite,
        fontSize: '0.68rem',
        color: darkTheme.textOnLight,
    },
    outside: {
        opacity: 0.4,
    },
    weekend: {
        backgroundColor: darkTheme.backgroundAlmostNearWhite,
    },
    today: {
        backgroundColor: darkTheme.textGreenDark,
        color: darkTheme.backgroundRealWhite,
        fontWeight: 700,
    },
    barLine: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2,
        marginBottom: 3,
    },
    bar: {
        padding: '2px 6px',
        borderRadius: 3,
        fontSize: '0.68rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        backgroundColor: darkTheme.backgroundAlmostNearWhite2,
        color: darkTheme.textOnLightDark,
        borderLeft: `3px solid ${darkTheme.textGreenDark}`,
    },
    barOneDay: {
        backgroundColor: darkTheme.textGreenDark,
        borderLeftColor: darkTheme.textGreenDark,
        color: darkTheme.backgroundRealWhite,
    },
    legend: {
        marginTop: 8,
        fontSize: '0.68rem',
        color: darkTheme.textOnLightLighter,
    },
    empty: {
        fontSize: '0.75rem',
        color: darkTheme.textOnLightLighter,
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        bar: {
            fontSize: '0.6rem',
        },
        day: {
            minHeight: 18,
            fontSize: '0.6rem',
        },
    },
})

/**
 * A real month grid, which the calendar never had. The point of a grid over a
 * list is the bar: an event from Friday to Sunday is one bar across three day
 * columns, so overlaps and free weekends are obvious at a glance.
 */
const MonthGrid = ({ year, month, events, today }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const grid = buildMonthGrid(year, month, events)
    const monthEvents = events.filter((event) => {
        const span = eventSpan(event)
        return (
            span && span.start.getFullYear() === year && span.start.getMonth() === month
        )
    })

    return (
        <div className={classes.grid} data-testid={`calendar.monthGrid.${year}-${month + 1}`}>
            <h3 className={classes.title}>
                {`${monthName(t, month)} ${year} `}
                <span className={classes.titleCount}>
                    {`· ${t('Calendar.weekendCount', { count: monthEvents.length })}`}
                </span>
            </h3>
            <div className={classes.week}>
                {Array.from({ length: 7 }, (_, index) => (
                    <div key={index} className={classes.dow}>
                        {weekdayShort(t, index)}
                    </div>
                ))}
            </div>
            {grid.weeks.map((week, weekIndex) => (
                <React.Fragment key={weekIndex}>
                    <div className={classes.week}>
                        {week.days.map((day) => {
                            const outside = day.getMonth() !== month
                            const isToday =
                                day.getFullYear() === today.getFullYear() &&
                                day.getMonth() === today.getMonth() &&
                                day.getDate() === today.getDate()
                            const weekend = day.getDay() === 0 || day.getDay() === 6

                            return (
                                <div
                                    key={day.getTime()}
                                    className={`${classes.day} ${outside ? classes.outside : ''} ${
                                        weekend && !outside ? classes.weekend : ''
                                    } ${isToday ? classes.today : ''}`}
                                >
                                    {day.getDate()}
                                </div>
                            )
                        })}
                    </div>
                    {Array.from({ length: week.lanes }, (_, lane) => (
                        <div className={classes.barLine} key={`lane-${lane}`}>
                            {week.bars
                                .filter((bar) => bar.lane === lane)
                                .map((bar) => {
                                    const oneDay = bar.columnStart === bar.columnEnd

                                    return (
                                        <div
                                            key={bar.event.id}
                                            className={`${classes.bar} ${oneDay ? classes.barOneDay : ''}`}
                                            style={{
                                                gridColumn: `${bar.columnStart + 1} / span ${
                                                    bar.columnEnd - bar.columnStart + 1
                                                }`,
                                            }}
                                            title={bar.event.name ?? ''}
                                        >
                                            {bar.event.name}
                                        </div>
                                    )
                                })}
                        </div>
                    ))}
                </React.Fragment>
            ))}
            {monthEvents.length === 0 && <div className={classes.empty}>{t('Calendar.monthGrid.noEvents')}</div>}
            <div className={classes.legend}>{t('Calendar.monthGrid.legend')}</div>
        </div>
    )
}

export default MonthGrid
