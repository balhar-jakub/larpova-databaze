import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useQuery } from '@apollo/client'
import { useTranslation } from 'src/lib/i18n'
import {
    SearchPageGroupsQuery,
    SearchPageGroupsQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import SearchGroupRow from './SearchGroupRow'
import { componentTestIds } from '../componentTestIds'

const searchGroupsGql = require('./graphql/searchGroups.graphql')

interface Props {
    readonly query: string
    /** Total from the overview query — `groupsByQuery` itself returns no total. */
    readonly totalAmount: number
}

const PAGE_SIZE = 20

const useStyles = createUseStyles({
    heading: {
        fontSize: '0.85rem',
        padding: '0 0 10px',
    },
    more: {
        marginTop: 8,
    },
    moreButton: {
        background: 'transparent',
        border: '1px solid #6dc8b7',
        borderRadius: 4,
        color: '#6dc8b7',
        fontSize: '0.8rem',
        fontWeight: 700,
        padding: '6px 14px',
        cursor: 'pointer',
    },
})

type GroupRow = SearchPageGroupsQuery['groupsByQuery'][number]

/**
 * Groups authors games and the header search has always been able to find one,
 * yet the search page never listed a single group.
 */
const GroupsSearchPanel = ({ query, totalAmount }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [offset, setOffset] = useState(0)
    const [rows, setRows] = useState<GroupRow[]>([])

    const { loading } = useQuery<SearchPageGroupsQuery, SearchPageGroupsQueryVariables>(searchGroupsGql, {
        variables: {
            query,
            offset,
            limit: PAGE_SIZE,
        },
        fetchPolicy: offset === 0 ? 'cache-first' : 'network-only',
        onCompleted: data => {
            setRows(previous => (offset === 0 ? data.groupsByQuery : [...previous, ...data.groupsByQuery]))
        },
    })

    useEffect(() => {
        setOffset(0)
    }, [query])

    if (loading && rows.length === 0) {
        return <BigLoading />
    }

    const remaining = Math.max(0, totalAmount - rows.length)

    return (
        <>
            <div className={classes.heading} data-testid={componentTestIds.search.resultCount}>
                {rows.length === 0 ? t('Search.notFound') : t('Search.resultCountGroups', { count: totalAmount })}
            </div>
            <div style={loading ? { opacity: 0.5 } : undefined} data-testid={componentTestIds.search.section('groups')}>
                {rows.map(group => (
                    <SearchGroupRow group={group} query={query} key={group.id} />
                ))}
            </div>
            {remaining > 0 && (
                <div className={classes.more}>
                    <button
                        type="button"
                        className={classes.moreButton}
                        onClick={() => setOffset(rows.length)}
                        disabled={loading}
                        data-testid={componentTestIds.catalog.loadMore}
                    >
                        {loading ? t('Catalog.loading') : t('Search.loadMore', { count: Math.min(PAGE_SIZE, remaining) })}
                    </button>
                </div>
            )}
        </>
    )
}

export default GroupsSearchPanel
