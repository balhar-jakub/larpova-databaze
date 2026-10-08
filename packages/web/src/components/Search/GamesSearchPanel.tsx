import React, { useState, useEffect } from 'react'
import { createUseStyles } from 'react-jss'
import { useQuery } from '@apollo/client'
import { useTranslation } from 'src/lib/i18n'
import {
    SearchPageGamesQuery,
    SearchPageGamesQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import Pager from '../common/Pager/Pager'
import SearchSuggestion from './SearchSuggestion'
import SearchGameRow from './SearchGameRow'
import { componentTestIds } from '../componentTestIds'

const searchGamesGql = require('./graphql/searchPageGames.graphql')

interface Props {
    readonly query: string
    readonly onUseSuggestion: (suggestion: string) => void
}

const PAGE_SIZE = 25

const useStyles = createUseStyles({
    heading: {
        fontSize: '0.85rem',
        padding: '0 0 10px',
    },
})

type Page = SearchPageGamesQuery['games']['byQueryWithTotal']

/**
 * The whole games result, shown when the visitor opens the games section (or
 * picks the games chip). Every row says why it matched (`SearchGameRow`) — the
 * engine also looks at authors and groups, so a row without any visible `larp`
 * is a normal result, not a mistake.
 */
const GamesSearchPanel = ({ query, onUseSuggestion }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [offset, setOffset] = useState(0)
    const [page, setPage] = useState<Page | undefined>(undefined)
    const { loading } = useQuery<SearchPageGamesQuery, SearchPageGamesQueryVariables>(searchGamesGql, {
        variables: {
            query,
            offset,
            limit: PAGE_SIZE,
        },
        onCompleted: data => {
            setPage(data.games.byQueryWithTotal)
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
            {page.games.length === 0
                ? t('Search.notFound')
                : t('Search.resultCountGames', { count: page.totalAmount })}
        </div>
    )

    if (page.games.length === 0) {
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
                data-testid={componentTestIds.search.section('games')}
            >
                {page.games.map(game => (
                    <SearchGameRow game={game} query={query} key={game.id} />
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

export default GamesSearchPanel
