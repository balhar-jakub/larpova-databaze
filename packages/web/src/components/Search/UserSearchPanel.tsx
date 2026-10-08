import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { useQuery } from '@apollo/client'
import {
    SearchPageUsersQuery,
    SearchPageUsersQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import Pager from '../common/Pager/Pager'
import SearchSuggestion from './SearchSuggestion'
import SearchPersonRow from './SearchPersonRow'
import { componentTestIds } from '../componentTestIds'

const searchUsersGql = require('./graphql/searchPageUsers.graphql')

interface Props {
    readonly query: string
    readonly onUseSuggestion: (suggestion: string) => void
}

const PAGE_SIZE = 24

const useStyles = createUseStyles({
    heading: {
        fontSize: '0.85rem',
        padding: '0 0 10px',
    },
})

type PersonRow = SearchPageUsersQuery['usersByQueryWithTotal']['users'][number]

/**
 * The whole people result. This tab was always the good one — it highlighted the
 * match and offered the games of the person; the row component keeps both and
 * adds what the engine actually matches on (nickname, city), so the list does
 * not look arbitrary.
 */
const UserSearchPanel = ({ query, onUseSuggestion }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [offset, setOffset] = useState(0)
    const { data, loading } = useQuery<SearchPageUsersQuery, SearchPageUsersQueryVariables>(searchUsersGql, {
        variables: {
            query,
            offset,
            limit: PAGE_SIZE,
        },
    })

    useEffect(() => {
        // Go to first page on query change
        setOffset(0)
    }, [query])

    const page = data?.usersByQueryWithTotal

    if (!page) {
        return <BigLoading />
    }

    const heading = (
        <div className={classes.heading} data-testid={componentTestIds.search.resultCount}>
            {page.users.length === 0
                ? t('Search.notFound')
                : t('Search.resultCountUsers', { count: page.totalAmount })}
        </div>
    )

    if (page.users.length === 0) {
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
                style={loading ? { opacity: 0.5 } : undefined}
                data-testid={componentTestIds.search.section('users')}
            >
                {(page.users as PersonRow[]).map(user => (
                    <SearchPersonRow person={user} query={query} key={user.id} />
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
    )
}

export default UserSearchPanel
