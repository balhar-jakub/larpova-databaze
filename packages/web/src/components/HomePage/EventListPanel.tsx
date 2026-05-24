import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { Event } from '../../graphql/__generated__/typescript-operations'
import { DetailListHeader } from '../common/DetailListHeader/DetailListHeader'
import { darkTheme } from '../../theme/darkTheme'
import { formatTimeRange } from '../../utils/dateUtils'

import EventLink from '../common/EventLink/EventLink'

interface Props {
    readonly events: Array<Pick<Event, 'id' | 'name' | 'from' | 'to'>>
    readonly titleKey?: string
}

const useStyles = createUseStyles({
    wrapper: {
        padding: 15,
        marginBottom: 12,
    },
    event: {
        display: 'block',
        color: darkTheme.textOnLightDark,
        fontSize: '0.75rem',
        padding: '4px 6px 4px 16px',
        lineHeight: '150%',

        '&.future': {
            fontWeight: 'bold',
        },

        '&:hover': {
            color: darkTheme.textOnLight,
        },
    },
})

export const EventListPanel = ({ events, titleKey }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <>
            {titleKey && <DetailListHeader>{t(titleKey)}</DetailListHeader>}
            <div className={classes.wrapper}>
                {events.map(event => {
                    const { fromFormatted, toFormatted, justOneDate, future } = formatTimeRange(event?.from, event?.to)

                    return (
                        <EventLink className={classNames(classes.event, { future })} key={event.id} event={event}>
                            {event.name} ({justOneDate ? fromFormatted : `${fromFormatted} - ${toFormatted}`})
                        </EventLink>
                    )
                })}
            </div>
        </>
    )
}
