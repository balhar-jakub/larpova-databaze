import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'
import { CalendarEventDataFragment, CalendarStatsQuery } from '../../graphql/__generated__/typescript-operations'
import CalendarEventCard from './CalendarEventCard'
import { groupEventsByWeek, monthShort } from './calendarUtils'

type StatsMonth = CalendarStatsQuery['eventCalendarStats']['byMonth'][number]

interface Props {
    readonly byMonth: StatsMonth[]
    readonly totalAmount: number
    readonly today: Date
    readonly selectedYear?: number
    readonly onSelectYear: (year: number) => void
    readonly yearEvents: CalendarEventDataFragment[]
    readonly loadingYear: boolean
    readonly hasMoreYear: boolean
    readonly onLoadMoreYear: () => void
}

const useStyles = createUseStyles({
    card: {
        backgroundColor: darkTheme.backgroundRealWhite,
        borderRadius: 5,
        padding: 12,
        marginBottom: 14,
    },
    title: {
        margin: '0 0 4px',
        fontSize: '0.95rem',
        color: darkTheme.textOnLightDark,
        fontWeight: 700,
    },
    subtitle: {
        margin: '0 0 10px',
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
    },
    row: {
        display: 'grid',
        gridTemplateColumns: '46px 1fr 40px 90px',
        alignItems: 'center',
        gap: 8,
        padding: '1px 0',
        border: 0,
        background: 'transparent',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        borderRadius: 3,

        '&:hover': {
            backgroundColor: darkTheme.backgroundNearWhite,
        },
    },
    rowSelected: {
        backgroundColor: darkTheme.backgroundNearWhite,
        fontWeight: 700,
    },
    rowEmpty: {
        cursor: 'default',
        color: darkTheme.textLighter,
    },
    year: {
        fontSize: '0.78rem',
        color: darkTheme.textOnLightDark,
        fontWeight: 600,
    },
    bar: {
        display: 'flex',
        height: 14,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: darkTheme.backgroundNearWhite,
    },
    barPast: {
        backgroundColor: darkTheme.textDark,
    },
    barFuture: {
        backgroundColor: darkTheme.textGreenDark,
    },
    barEmpty: {
        borderTop: `1px dashed ${darkTheme.backgroundAlmostNearWhite}`,
        backgroundColor: 'transparent',
        height: 14,
    },
    number: {
        fontSize: '0.72rem',
        textAlign: 'right',
        color: darkTheme.textOnLight,
    },
    months: {
        display: 'flex',
        gap: 2,
        alignItems: 'center',
    },
    monthCell: {
        width: 9,
        borderRadius: 2,
        backgroundColor: darkTheme.backgroundNearWhite,
        height: 12,
    },
    legend: {
        marginTop: 8,
        fontSize: '0.68rem',
        color: darkTheme.textOnLightLighter,
    },
    yearTitle: {
        margin: '0 0 8px',
        fontSize: '0.9rem',
        color: darkTheme.textOnLightDark,
        fontWeight: 700,
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        row: {
            gridTemplateColumns: '38px 1fr 34px',
        },
        months: {
            display: 'none',
        },
    },
})

/**
 * The archive. The database holds ~2 600 events going back to 2009 and the page
 * never showed them, although they answer the questions the calendar is asked:
 * how busy a season normally is, and which years went missing (2024 and 2025
 * hold no events at all). Years without data are drawn as empty rows on
 * purpose — a missing year is a finding, not something to hide.
 */
const HistoryView = ({
    byMonth,
    totalAmount,
    today,
    selectedYear,
    onSelectYear,
    yearEvents,
    loadingYear,
    hasMoreYear,
    onLoadMoreYear,
}: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const currentMonthKey = today.getFullYear() * 12 + today.getMonth()

    const years = new Map<number, { past: number; future: number; months: number[] }>()
    byMonth.forEach((month) => {
        const entry = years.get(month.year) ?? { past: 0, future: 0, months: Array(12).fill(0) as number[] }
        const isPast = month.year * 12 + (month.month - 1) < currentMonthKey
        if (isPast) entry.past += month.count
        else entry.future += month.count
        entry.months[month.month - 1] += month.count
        years.set(month.year, entry)
    })

    const minYear = Math.min(...byMonth.map((month) => month.year), today.getFullYear())
    const maxYear = Math.max(...byMonth.map((month) => month.year), today.getFullYear())
    const list = Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index).map((year) => ({
        year,
        ...(years.get(year) ?? { past: 0, future: 0, months: Array(12).fill(0) as number[] }),
    }))

    const max = Math.max(1, ...list.map((item) => item.past + item.future))
    const emptyYears = list.filter((item) => item.past + item.future === 0).map((item) => item.year)
    const totals = list.reduce(
        (acc, item) => ({ past: acc.past + item.past, future: acc.future + item.future }),
        { past: 0, future: 0 },
    )

    const blocks = groupEventsByWeek(yearEvents)

    return (
        <>
            <div className={classes.card} data-testid="calendar.history">
                <h3 className={classes.title}>{t('Calendar.history.title')}</h3>
                <div className={classes.subtitle}>
                    {t('Calendar.history.subtitle', {
                        total: totalAmount,
                        past: totals.past,
                        future: totals.future,
                    })}
                </div>
                {list.map((item) => {
                    const total = item.past + item.future
                    return (
                        <button
                            type="button"
                            key={item.year}
                            className={`${classes.row} ${item.year === selectedYear ? classes.rowSelected : ''} ${
                                total === 0 ? classes.rowEmpty : ''
                            }`}
                            onClick={() => total > 0 && onSelectYear(item.year)}
                            disabled={total === 0}
                            data-testid={`calendar.historyYear.${item.year}`}
                        >
                            <span className={classes.year}>{item.year}</span>
                            <span className={classes.bar}>
                                {total > 0 && (
                                    <>
                                        <span
                                            className={classes.barPast}
                                            style={{ width: `${(100 * item.past) / max}%` }}
                                        />
                                        <span
                                            className={classes.barFuture}
                                            style={{ width: `${(100 * item.future) / max}%` }}
                                        />
                                    </>
                                )}
                                {total === 0 && <span className={classes.barEmpty} style={{ width: '100%' }} />}
                            </span>
                            <span className={classes.number}>{total === 0 ? '0' : total}</span>
                            <span className={classes.months}>
                                {item.months.map((count, monthIndex) => (
                                    <span
                                        key={monthIndex}
                                        className={classes.monthCell}
                                        title={`${monthShort(t, monthIndex)}: ${count}`}
                                        style={
                                            count > 0
                                                ? {
                                                      backgroundColor: darkTheme.textGreenDark,
                                                      opacity: 0.35 + Math.min(count, 10) / 10 * 0.65,
                                                      height: 12,
                                                  }
                                                : undefined
                                        }
                                    />
                                ))}
                            </span>
                        </button>
                    )
                })}
                <div className={classes.legend}>
                    {t('Calendar.history.legend')}
                    {emptyYears.length > 0 && ` ${t('Calendar.history.emptyYears', { years: emptyYears.join(', ') })}`}
                </div>
            </div>

            {selectedYear && (
                <div data-testid="calendar.historyYearList">
                    <h3 className={classes.yearTitle}>{t('Calendar.history.yearTitle', { year: selectedYear })}</h3>
                    {loadingYear && <div className={classes.subtitle}>{t('Calendar.loading')}</div>}
                    {!loadingYear && blocks.length === 0 && (
                        <div className={classes.subtitle}>{t('Calendar.history.noEvents')}</div>
                    )}
                    {blocks.map((block) => (
                        <div key={block.key} style={{ marginBottom: 10 }}>
                            {block.events.map((event) => (
                                <CalendarEventCard key={event.id} event={event} />
                            ))}
                        </div>
                    ))}
                    {hasMoreYear && (
                        <div style={{ textAlign: 'center', marginTop: 10 }}>
                            <button type="button" className={classes.rowSelected} onClick={onLoadMoreYear} style={{ padding: '8px 16px', borderRadius: 4, border: 0, cursor: 'pointer' }}>
                                {t('Calendar.loadMore', { count: 100 })}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}

export default HistoryView
