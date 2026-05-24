import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { CalendarEventDataFragment } from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import EventLink from '../common/EventLink/EventLink'
import { formatTimeRange } from '../../utils/dateUtils'
import { breakPoints } from '../../theme/breakPoints'

interface Props {
    readonly event: CalendarEventDataFragment
}

const useStyles = createUseStyles({
    wrapper: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        margin: '0 0 8px',
        backgroundColor: darkTheme.backgroundRealWhite,
        fontSize: '0.75rem',
        borderRadius: 5,
        flexWrap: 'wrap',
    },
    fact: {
        flexBasis: '100%',
        margin: '0 16px',
        flex: 0,
        whiteSpace: 'nowrap',
    },
    text: {
        margin: '0 16px',
        flex: 1,
        flexBasis: '100%',
    },
    link: {
        color: darkTheme.textGreen,

        '&:hover': {
            color: darkTheme.text,
        },
    },
    name: {
        fontSize: '1rem',
        color: darkTheme.textOnLightDark,
        '&:hover': {
            color: darkTheme.textGreen,
        },
    },
    labels: {
        color: darkTheme.textDark,
    },
    dates: {
        padding: '12px 0',
        color: darkTheme.textDark,
    },
    [`@media(min-width: ${breakPoints.md}px)`]: {
        wrapper: {
            flexWrapper: 'nowrap',
        },
        text: {
            flexBasis: 0,
        },
        fact: {
            flexBasis: 60,
        },
        dates: {
            padding: 0,
            flexBasis: 120,
        },
    },
    [`@media(min-width: ${breakPoints.lg}px)`]: {
        fact: {
            flexBasis: 120,
        },
        text: {
            flexBasis: 0,
        },
    },
})

const CalendarEventPanel = ({ event }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const { fromFormatted, toFormatted, justOneDate } = formatTimeRange(event?.from, event?.to)

    return (
        <div className={classes.wrapper}>
            <div className={classes.text}>
                <EventLink event={event} className={classNames(classes.link, classes.name)}>
                    {event.name}
                </EventLink>
                <br />
                <div className={classes.labels}>{event.labels?.map(label => label.name).join(', ')}</div>
            </div>
            <div className={classNames(classes.fact, classes.dates)}>
                {!justOneDate && `${t('EventCalendar.eventFrom')}: `}
                {fromFormatted}
                {!justOneDate && (
                    <>
                        <br />
                        {t('EventCalendar.eventTo')}: {toFormatted}
                    </>
                )}
            </div>
            <div className={classes.fact}>
                {event.web && (
                    <a href={event.web} target="_blank" rel="noreferrer" className={classes.link}>
                        {t('EventCalendar.link')}
                    </a>
                )}
            </div>
        </div>
    )
}

export default CalendarEventPanel
