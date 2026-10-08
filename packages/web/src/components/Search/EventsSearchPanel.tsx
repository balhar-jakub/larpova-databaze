import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { useQuery } from '@apollo/client'
import { useTranslation } from 'src/lib/i18n'
import {
    SearchPageEventsQuery,
    SearchPageEventsQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import Pager from '../common/Pager/Pager'
import { darkTheme } from '../../theme/darkTheme'
import SearchSuggestion from './SearchSuggestion'
import SearchEventRow from './SearchEventRow'
import { componentTestIds } from '../componentTestIds'
import {
    EVENT_TIME_FILTERS,
    EventTimeFilter,
    duplicateCount,
    eventTimeRange,
} from './searchHelpers'

const searchEventsGql = require('./graphql/searchPageEvents.graphql')

interface Props {
    readonly query: string
    readonly onUseSuggestion: (suggestion: string) => void
}

const PAGE_SIZE = 20

const TIME_LABEL_KEY: Record<EventTimeFilter, string> = {
    all: 'Search.timeAll',
    upcoming: 'Search.timeUpcoming',
    archive: 'Search.timeArchive',
}

const useStyles = createUseStyles({
    heading: {
        fontSize: '0.85rem',
        padding: '0 0 10px',
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    label: {
        fontSize: '0.72rem',
        color: darkTheme.textDark,
    },
    chip: {
        border: `1px solid ${darkTheme.backgroundControl}`,
        background: darkTheme.background,
        color: darkTheme.text,
        borderRadius: 12,
        padding: '3px 12px',
        fontSize: '0.78rem',
        cursor: 'pointer',
    },
    chipActive: {
        background: '#1d3f42',
        borderColor: darkTheme.textGreen,
        color: darkTheme.textGreen,
        fontWeight: 700,
    },
})

type Page = SearchPageEventsQuery['eventsByQuery']

/**
 * The whole events result.
 *
 * Two things this list had to fix, both measured on production: the calendar
 * card carries no date (the day heading above it does, and a search list has no
 * headings — 153 events arrived without a single visible date), and 80 of those
 * 153 rows were 5 clusters of visually identical rows (18x "Larpová chata"),
 * which the API now returns as one row with a count. The time filter uses the
 * `from`/`to` arguments the query always had.
 */
const EventsSearchPanel = ({ query, onUseSuggestion }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [offset, setOffset] = useState(0)
    const [timeFilter, setTimeFilter] = useState<EventTimeFilter>('all')
    const [page, setPage] = useState<Page | undefined>(undefined)
    const { from, to } = eventTimeRange(timeFilter)

    const { loading } = useQuery<SearchPageEventsQuery, SearchPageEventsQueryVariables>(searchEventsGql, {
        variables: {
            query,
            offset,
            limit: PAGE_SIZE,
            from,
            to,
        },
        onCompleted: data => {
            setPage(data.eventsByQuery)
        },
    })

    useEffect(() => {
        // Go to first page on query change
        setOffset(0)
    }, [query])

    useEffect(() => {
        // A different time window is a different result — start at its beginning
        setOffset(0)
    }, [timeFilter])

    if (!page) {
        return <BigLoading />
    }

    const heading = (
        <div className={classes.heading} data-testid={componentTestIds.search.resultCount}>
            {page.events.length === 0
                ? // With a time window on, "nothing matches the query" is a lie when
                  // the query does match — just not in this window.
                  t(timeFilter === 'all' ? 'Search.notFound' : 'Search.notFoundInWindow')
                : t('Search.resultCountEvents', { count: page.totalAmount })}
        </div>
    )

    return (
        <>
            {heading}
            <SearchSuggestion suggestion={page.suggestion} onUse={onUseSuggestion} />
            <div className={classes.toolbar} data-testid={componentTestIds.search.timeFilter}>
                <span className={classes.label}>{t('Search.timeLabel')}</span>
                {EVENT_TIME_FILTERS.map(filter => (
                    <button
                        key={filter}
                        type="button"
                        className={classNames({
                            [classes.chip]: true,
                            [classes.chipActive]: filter === timeFilter,
                        })}
                        onClick={() => setTimeFilter(filter)}
                        data-testid={componentTestIds.search.timeOption(filter)}
                        aria-pressed={filter === timeFilter}
                    >
                        {t(TIME_LABEL_KEY[filter])}
                    </button>
                ))}
            </div>
            {page.events.length === 0 ? null : (
                <>
                    <div
                        style={loading ? { opacity: 0.5 } : undefined}
                        data-testid={componentTestIds.search.section('events')}
                    >
                        {page.events.map(event => (
                            <SearchEventRow
                                event={event}
                                query={query}
                                key={event.id}
                                duplicateCount={duplicateCount(page.duplicates, event.id)}
                            />
                        ))}
                    </div>
                    <Pager
                        currentOffset={offset}
                        totalAmount={page.totalAmount}
                        pageSize={PAGE_SIZE}
                        onOffsetChanged={setOffset}
                        rangeLabel
                    />
                </>
            )}
        </>
    )
}

export default EventsSearchPanel
