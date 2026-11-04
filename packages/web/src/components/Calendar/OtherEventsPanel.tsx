import React, { useMemo, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { CalendarEventDataFragment } from '../../graphql/__generated__/typescript-operations'
import CalendarEventCard from './CalendarEventCard'
import { eventSpan, formatShortRange, groupEventsByWeek, relativeHint } from './calendarUtils'

interface Props {
    readonly events: CalendarEventDataFragment[]
    readonly today: Date
}

/** How many cards the collapsed panel shows before the "show all" line. */
const COLLAPSED_COUNT = 2

const useStyles = createUseStyles({
    panel: {
        marginTop: 18,
        border: '1px dashed #d0d0d0',
        borderRadius: 6,
        backgroundColor: '#fbfbfb',
        padding: '10px 14px 14px',
    },
    head: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    title: {
        margin: 0,
        fontSize: '0.95rem',
        color: darkTheme.textOnLightDark,
    },
    countBadge: {
        backgroundColor: '#e8e0f5',
        color: '#5e4b8b',
        borderRadius: 9,
        padding: '1px 8px',
        fontSize: '0.7rem',
        fontWeight: 700,
    },
    subtitle: {
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
    },
    toggle: {
        marginLeft: 'auto',
        border: 0,
        background: 'none',
        color: darkTheme.textGreenDark,
        fontSize: '0.72rem',
        cursor: 'pointer',
        textDecoration: 'underline',
        padding: 0,
    },
    block: {
        marginBottom: 10,
    },
    blockHead: {
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
        borderLeft: `2px solid #e0e0e0`,
        paddingLeft: 14,
    },
    more: {
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
        margin: '8px 0 0',
    },
    moreButton: {
        border: 0,
        background: 'none',
        padding: 0,
        color: darkTheme.textGreenDark,
        fontSize: '0.72rem',
        cursor: 'pointer',
        textDecoration: 'underline',
    },
})

/**
 * The secondary panel under the weekend agenda: events swept in from the
 * sermiri.cz catalogue. They are real events, but usually not larps, so they
 * are rendered muted, grouped by weekend like the main list, collapsed to the
 * first two cards with a "show all" line — one click away, not interleaved
 * with the larp runs as if they were equal priority.
 */
const OtherEventsPanel = ({ events, today }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [expanded, setExpanded] = useState(false)

    const visible = useMemo(() => (expanded ? events : events.slice(0, COLLAPSED_COUNT)), [events, expanded])
    const blocks = useMemo(() => groupEventsByWeek(visible), [visible])
    const hiddenCount = events.length - Math.min(events.length, COLLAPSED_COUNT)

    return (
        <div className={classes.panel} data-testid="calendar.otherEvents">
            <div className={classes.head}>
                <h2 className={classes.title}>
                    {t('Calendar.otherEvents')} <span className={classes.countBadge}>{events.length}</span>
                </h2>
                <span className={classes.subtitle}>{t('Calendar.otherEventsSubtitle')}</span>
                {events.length > COLLAPSED_COUNT && (
                    <button
                        type="button"
                        className={classes.toggle}
                        onClick={() => setExpanded((current) => !current)}
                        data-testid="calendar.otherEventsToggle"
                    >
                        {expanded ? t('Calendar.otherEventsCollapse') : t('Calendar.otherEventsExpand')}
                    </button>
                )}
            </div>
            {blocks.map((block, index) => {
                const nextBlock = blocks[index + 1]
                const span = eventSpan(block.events[0])

                return (
                    <div className={classes.block} key={block.key}>
                        <div className={classes.blockHead}>
                            <span className={classes.range}>{formatShortRange(t, block.from, block.to)}</span>
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
                                <CalendarEventCard key={event.id} event={event} muted />
                            ))}
                        </div>
                    </div>
                )
            })}
            {!expanded && hiddenCount > 0 && (
                <p className={classes.more}>
                    {t('Calendar.otherEventsMore', { count: hiddenCount })}{' '}
                    <button
                        type="button"
                        className={classes.moreButton}
                        onClick={() => setExpanded(true)}
                        data-testid="calendar.otherEventsShowAll"
                    >
                        {t('Calendar.otherEventsShowAll')}
                    </button>
                </p>
            )}
        </div>
    )
}

export default OtherEventsPanel
