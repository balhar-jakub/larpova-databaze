import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { useQuery } from '@apollo/client'
import {
    SearchPageUsersQuery,
    SearchPageUsersQueryVariables,
    UsersPaged,
} from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import Pager from '../common/Pager/Pager'
import { darkTheme } from '../../theme/darkTheme'
import UserLink from '../common/UserLink/UserLink'
import { TextLink } from '../common/TextLink/TextLink'
import { computeAge } from '../../utils/dateUtils'
import { ProfileImage } from '../common/ProfileImage/ProfileImage'
import { useRoutes } from '../../hooks/useRoutes'
import HighlightedText from './HighlightedText'
import SearchSuggestion from './SearchSuggestion'
import { componentTestIds } from '../componentTestIds'

const searchUsersGql = require('./graphql/searchPageUsers.graphql')

interface Props {
    readonly query: string
    readonly onUseSuggestion: (suggestion: string) => void
}

const PAGE_SIZE = 24

type UserRow = UsersPaged['users'][number]

const useStyles = createUseStyles({
    heading: {
        fontSize: '0.85rem',
        padding: '0 0 10px',
    },
    itemHolder: {
        margin: -5,
        display: 'flex',
        flexWrap: 'wrap',
    },
    item: {
        margin: 5,
        padding: '10px 15px 10px 10px',
        background: darkTheme.backgroundRealWhite,
        color: darkTheme.textOnLight,
        borderRadius: 10,
        display: 'flex',
        maxWidth: 330,
    },
    info: {
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
    },
    name: {
        color: darkTheme.textOnLightDark,
    },
    gamesLink: {
        marginTop: 2,
        fontSize: '0.75rem',
    },
})

/**
 * People tab of the search page. Matches names, nicknames and cities through the
 * shared engine (diacritics and word order do not decide), shows *why* each row
 * matched by highlighting the words, and offers the games of the person — the
 * "who is this and what did they write" question a visitor actually has.
 */
const UserSearchPanel = ({ query, onUseSuggestion }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const routes = useRoutes()
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
            <div className={classes.itemHolder} style={loading ? { opacity: 0.5 } : undefined}>
                {page.users.map(user => (
                    <div className={classes.item} key={user.id} data-testid={componentTestIds.search.userCard(user.id)}>
                        <ProfileImage userId={user.id} imageId={user.image?.id} />
                        <div className={classes.info}>
                            <span className={classes.name}>
                                {user.nickname ? (
                                    <>
                                        <HighlightedText text={`${user.nickname} `} query={query} />
                                    </>
                                ) : null}
                                <UserLink userId={user.id}>
                                    <HighlightedText text={user.name} query={query} />
                                </UserLink>
                            </span>
                            <span>
                                <HighlightedText text={user.city} query={query} />
                                {user.city && user.birthDate ? ', ' : ''}
                                {user.birthDate ? t('Search.userAge', { age: computeAge(user.birthDate) }) : ''}
                            </span>
                            <TextLink
                                className={classes.gamesLink}
                                href={routes.gamesOfAuthor(user.id, user.name).href}
                                as={routes.gamesOfAuthor(user.id, user.name).as}
                            >
                                {t('Search.userGames', { name: user.name })}
                            </TextLink>
                        </div>
                    </div>
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

export default UserSearchPanel
