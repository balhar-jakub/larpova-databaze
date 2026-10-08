import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useQuery } from '@apollo/client'
import { useTranslation } from 'src/lib/i18n'
import {
    CalendarEventDataFragment,
    EventsPaged,
    SearchPageEventsQuery,
    SearchPageEventsQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import Pager from '../common/Pager/Pager'
import CalendarEventCard from '../Calendar/CalendarEventCard'
import SearchSuggestion from './SearchSuggestion'
import { componentTestIds } from '../componentTestIds'

const searchEventsGql = require('./graphql/searchPageEvents.graphql')

interface Props {
    readonly query: string
    readonly onUseSuggestion: (suggestion: string) => void
}

const PAGE_SIZE = 20

type Page = Pick<EventsPaged, 'totalAmount' | 'suggestion'> & {
    events: Array<CalendarEventDataFragment>
}

/**
 * Events tab of the search page. Until now events were reachable only through
 * the calendar filters (date, labels, place) — 2 733 of them had no text search
 * at all, so "the event whose name I half remember" had no way in.
 */
const EventsSearchPanel = ({ query, onUseSuggestion }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [offset, setOffset] = useState(0)
    const [page, setPage] = useState<Page | undefined>(undefined)
    const { loading } = useQuery<SearchPageEventsQuery, SearchPageEventsQueryVariables>(searchEventsGql, {
        variables: {
            query,
            offset,
            limit: PAGE_SIZE,
        },
        onCompleted: data => {
            setPage(data.eventsByQuery)
        },
    })

    useEffect(() => {
        // Go to first page on query change
        setOffset(0)
    }, [query])

    if (!page) {
        return <BigLoading />
    }

    const heading = (
        <div className={classes.heading} data-testid={componentTestIds.search.resultCount}>
            {page.events.length === 0
                ? t('Search.notFound')
                : t('Search.resultCountEvents', { count: page.totalAmount })}
        </div>
    )

    if (page.events.length === 0) {
        return (
            <>
                {heading}
                <SearchSuggestion suggestion={page.suggestion} onUse={onUseSuggestion} />
            </>
        )
    }

    return (
        <>
            {heading}
            <SearchSuggestion suggestion={page.suggestion} onUse={onUseSuggestion} />
            <div
                className={classes.list}
                style={loading ? { opacity: 0.5 } : undefined}
                data-testid={componentTestIds.search.eventList}
            >
                {page.events.map(event => (
                    <CalendarEventCard key={event.id} event={event} />
                ))}
            </div>
            <Pager
                currentOffset={offset}
                totalAmount={page.totalAmount}
                pageSize={PAGE_SIZE}
                onOffsetChanged={setOffset}
            />
        </>
    )
}

const useStyles = createUseStyles({
    heading: {
        fontSize: '0.85rem',
        padding: '0 0 10px',
    },
    list: {
        marginBottom: 10,
    },
})

export default EventsSearchPanel
