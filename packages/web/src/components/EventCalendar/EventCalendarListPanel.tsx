import React, { useMemo, useState, Fragment } from 'react'
import { useTranslation } from 'src/lib/i18n'
import { createUseStyles } from 'react-jss'
import { useApolloClient, useQuery } from '@apollo/client'
import isInBrowser from 'is-in-browser'
import { darkTheme } from '../../theme/darkTheme'
import {
    CalendarEventDataFragment,
    LoadCalendarEventsQuery,
    LoadCalendarEventsQueryVariables,
    MoreCalendarEventsQuery,
    MoreCalendarEventsQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import Pager from '../common/Pager/Pager'
import CalendarEventPanel from './CalendarEventPanel'
import BigLoading from '../common/BigLoading/BigLoading'
import { formatISODate, parseDateTime } from '../../utils/dateUtils'
import { MonthSeparator } from './MonthSeparator'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'

const loadCalendarEventsGql = require('./graphql/loadCalendarEvents.graphql')
const moreCalendarEventsGql = require('./graphql/moreCalendarEvents.graphql')

interface Props {}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0',
    },
    loading: {
        opacity: 0.5,
    },
    iCal: {
        backgroundColor: darkTheme.backgroundRealWhite,
        fontStyle: 'italic',
        textAlign: 'center',
        padding: 20,
        borderRadius: 4,
        marginBottom: 20,
        '& a': {
            fontWeight: 'bold',
        },
    },
})

const PAGE_SIZE = 100

type Page = Partial<{
    events: CalendarEventDataFragment[]
    totalAmount: number
}>

const tabs: Array<TabDefinition<number>> = [
    {
        key: 0,
        title: { key: 'EventCalendar.events' },
    },
]

const EventCalendarListPanel = ({}: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [offset, setOffset] = useState(0)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState<Page>({})
    const client = useApolloClient()
    const now = useMemo(() => new Date(), [])

    useQuery<LoadCalendarEventsQuery, LoadCalendarEventsQueryVariables>(loadCalendarEventsGql, {
        variables: {
            from: formatISODate(now),
            offset: 0,
            limit: PAGE_SIZE,
        },
        ssr: false,
        skip: !isInBrowser,
        fetchPolicy: 'cache-and-network',
        nextFetchPolicy: 'cache-first',
        onCompleted: response => {
            setLoading(false)
            setPage(response?.eventCalendar || [])
        },
    })

    const { events } = page
    let currentMonth = ''

    const handleOffsetChanged = (newOffset: number) => {
        setOffset(newOffset)
        setLoading(true)
        client
            .query<MoreCalendarEventsQuery, MoreCalendarEventsQueryVariables>({
                query: moreCalendarEventsGql,
                fetchPolicy: 'network-only',
                variables: {
                    from: formatISODate(now),
                    offset: newOffset,
                    limit: PAGE_SIZE,
                },
            })
            .then(response => {
                setPage(response.data.eventCalendar)
                setLoading(false)
            })
    }

    return (
        <>
            <OpenGraphMeta
                title={t('EventCalendar.pageTitle')}
                description={t('EventCalendar.pageDescription')}
                image="/images/lk-logo.png"
            />
            <Tabs<number> tabs={tabs} selectedTab={0} />
            <div className={classes.row}>
                {!events && <BigLoading />}
                {events && (
                    <WidthFixer className={loading ? classes.loading : undefined}>
                        <div className={classes.iCal}>
                            <a href={t('EventCalendar.gCalUrl')} target="_blank" rel="noreferrer">
                                {t('EventCalendar.gCalLink')}
                            </a>
                            {t('EventCalendar.gCalText')}
                        </div>
                        {events.map(event => {
                            const lastMonth = currentMonth
                            const parsedDate = parseDateTime(event.from)
                            currentMonth = parsedDate
                                ? parsedDate.toLocaleString('cs-CZ', {
                                      month: 'long',
                                      year: 'numeric',
                                  })
                                : '???'
                            return (
                                <Fragment key={event.id}>
                                    {currentMonth !== lastMonth && (
                                        <MonthSeparator>{currentMonth}</MonthSeparator>
                                    )}
                                    <CalendarEventPanel event={event} />
                                </Fragment>
                            )
                        })}
                        <Pager
                            currentOffset={offset}
                            pageSize={PAGE_SIZE}
                            totalAmount={page.totalAmount ?? 0}
                            onOffsetChanged={handleOffsetChanged}
                        />
                    </WidthFixer>
                )}
            </div>
        </>
    )
}

export default EventCalendarListPanel
