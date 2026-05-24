import React, { useState, useEffect } from 'react'
import { useQuery } from '@apollo/client'
import { useTranslation } from 'react-i18next'
import {
    GamesPaged,
    LadderGameDataFragment,
    SearchPageGamesQuery,
    SearchPageGamesQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import LadderGamePanel from '../Ladders/LadderGamePanel'
import Pager from '../common/Pager/Pager'

const searchGamesGql = require('./graphql/searchPageGames.graphql')

interface Props {
    readonly query: string
}

const PAGE_SIZE = 25

type Page = Pick<GamesPaged, 'totalAmount'> & {
    games: Array<LadderGameDataFragment>
}

const GamesSearchPanel = ({ query }: Props) => {
    const { t } = useTranslation('common')
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

    if (page.games.length === 0) {
        return <span>{t('Search.notFound')}</span>
    }

    const handleOffsetChanged = (off: number) => {
        setOffset(off)
    }

    return (
        <>
            <div style={loading ? { opacity: 0.5 } : undefined}>
                {page.games.map(game => (
                    <LadderGamePanel game={game} key={game.id} />
                ))}
            </div>
            <Pager
                currentOffset={offset}
                totalAmount={page.totalAmount}
                pageSize={PAGE_SIZE}
                onOffsetChanged={handleOffsetChanged}
            />
        </>
    )
}

export default GamesSearchPanel
