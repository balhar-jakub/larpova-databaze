import React, { ChangeEvent, FormEvent, useRef, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { useQuery } from '@apollo/client'
import classNames from 'classnames'
import { darkTheme } from '../../../theme/darkTheme'
import { IconLoading, IconSearch } from '../Icons/Icons'
import { SearchAllQuery, SearchAllQueryVariables } from '../../../graphql/__generated__/typescript-operations'
import { GameBaseDataPanel } from '../GameBaseDataPanel/GameBaseDataPanel'
import { useRoutes } from '../../../hooks/useRoutes'
import { TextLink } from '../TextLink/TextLink'
import UserLink from '../UserLink/UserLink'
import { breakPoints } from '../../../theme/breakPoints'
import { formatDate, toEventDate } from '../../Calendar/calendarUtils'
import EventLink from '../EventLink/EventLink'
import { MIN_MATCH_QUERY_LENGTH } from '../../../utils/textUtils'
import HighlightedText from '../../Search/HighlightedText'
import { SearchType } from '../../Search/searchHelpers'
import { componentTestIds } from '../../componentTestIds'

export const searchInputId = 'headerSearchInput'

const searchAllQuery = require('./graphql/searchAll.graphql')

const useStyles = createUseStyles({
    wrapper: {
        display: 'flex',
        width: '100%',
        marginTop: 3,
        position: 'relative',
        transition: 'border-color ease-in-out .15s, box-shadow ease-in-out .15s',
        '&:focus-within': {
            borderColor: '#66afe9',
            outline: 0,
            boxShadow: 'inset 0 1px 1px rgba(0,0,0,.075), 0 0 8px rgba(102, 175, 233, .6)',
        },
        marginRight: 15,
        marginBottom: 5,
    },
    searchInput: {
        backgroundColor: darkTheme.backgroundControl,
        color: darkTheme.textLight,
        border: 'none',
        padding: '5px 24px 5px 8px',
        borderTopLeftRadius: 4,
        borderBottomLeftRadius: 4,
        flexGrow: 1,
        outline: 0,
        fontSize: '0.69rem',
    },
    searchButton: {
        backgroundColor: darkTheme.backgroundControl,
        color: darkTheme.text,
        border: 0,
        width: 26,
        height: 26,
        padding: '2px 0 0',
        overflow: 'hidden',
        cursor: 'pointer',
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        outline: 0,
    },
    results: {
        position: 'absolute',
        left: 0,
        minWidth: 250,
        width: '100%',
        top: 28,
        zIndex: 1001,
        padding: 7,
        background: darkTheme.backgroundControl,
        border: `1px solid ${darkTheme.textOnLightDark}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        maxHeight: '80vh',
        overflowY: 'auto',
    },
    resultsText: {
        padding: '10px 5px',
        alignSelf: 'center',
        color: darkTheme.text,
        fontSize: '0.75rem',
    },
    moreText: {
        padding: '4px 5px 8px',
        alignSelf: 'flex-end',
    },
    groupHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderBottom: `1px solid ${darkTheme.textOnLightDark}`,
        marginTop: 6,
        padding: '2px 2px 2px',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: darkTheme.text,
    },
    groupCount: {
        fontSize: '0.68rem',
        color: darkTheme.textGreenDark,
    },
    person: {
        padding: '5px 3px',
        fontSize: '0.8rem',
        color: darkTheme.textLight,
    },
    personMeta: {
        fontSize: '0.7rem',
        color: darkTheme.text,
    },
    iconLoading: {
        fontSize: '1.25rem',
    },
    gameSpacer: {
        marginTop: 7,
    },
    gameLoading: {
        opacity: 0.8,
    },
    suggestion: {
        padding: '8px 5px 4px',
        alignSelf: 'center',
        fontSize: '0.75rem',
        color: darkTheme.text,
    },
    suggestionLink: {
        background: 'transparent',
        border: 0,
        padding: 0,
        color: darkTheme.textGreenDark,
        fontWeight: 700,
        cursor: 'pointer',
        textDecoration: 'underline',
    },
    [`@media(min-width: ${breakPoints.md}px)`]: {
        searchInput: {
            width: 150,
        },
        wrapper: {
            marginBottom: 0,
        },
    },
})

/** How many rows of one kind fit in the dropdown; the rest goes to the page. */
const MAX_RESULTS_PER_KIND = 3
const MIN_SEARCH_LENGTH = MIN_MATCH_QUERY_LENGTH
const BLUR_TIMEOUT = 100
const CHANGE_TIMEOUT = 500

/**
 * The search field in the page header. It used to look at games only, so a
 * visitor typing a name of a person or of an event got "nothing found" while
 * the site had the row all along. It now shows every kind of result at once,
 * with the real number of matches and a link to the whole list.
 */
export const HeaderSearchForm = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [query, setQuery] = useState('')
    const [focused, setFocused] = useState(false)
    const hideTimeoutRef = useRef(0)
    const changeTimeoutRef = useRef(0)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const lastResult = useRef<SearchAllQuery['search'] | undefined>(undefined)
    const routes = useRoutes()
    const searchActive = query.length >= MIN_SEARCH_LENGTH
    const searchResult = useQuery<SearchAllQuery, SearchAllQueryVariables>(searchAllQuery, {
        variables: {
            query,
            limit: MAX_RESULTS_PER_KIND + 1,
        },
        fetchPolicy: 'cache-and-network',
        skip: !searchActive,
    })

    const result = searchResult.data?.search ?? lastResult.current
    lastResult.current = result
    const totalResults = result
        ? result.totalGames + result.totalUsers + result.totalEvents + result.totalGroups
        : 0
    const haveResults = totalResults > 0
    const loadingWithData = haveResults && searchResult.loading

    const handleFocus = () => {
        // When we were within hiding timeout, cancel it
        if (hideTimeoutRef.current) {
            window.clearTimeout(hideTimeoutRef.current)
        }
        hideTimeoutRef.current = 0
        inputRef.current?.focus() // Re-focus because we are called on menu focus too
        setFocused(true)
    }

    const handleBlur = () => {
        if (hideTimeoutRef.current) {
            window.clearTimeout(hideTimeoutRef.current)
        }
        hideTimeoutRef.current = window.setTimeout(() => setFocused(false), BLUR_TIMEOUT)
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (changeTimeoutRef.current) {
            window.clearTimeout(changeTimeoutRef.current)
        }
        const newValue = event.target.value
        if (query.length < MIN_SEARCH_LENGTH && newValue.length >= MIN_SEARCH_LENGTH) {
            // Just went over limit - start searching right away
            setQuery(event.target.value)
            changeTimeoutRef.current = 0
        } else {
            // Set after a while to rate limit search queries
            changeTimeoutRef.current = window.setTimeout(() => setQuery(newValue), CHANGE_TIMEOUT)
        }
    }

    const handleClickSearch = (e?: FormEvent<HTMLFormElement>) => {
        e?.preventDefault()
        e?.stopPropagation()
        const queryInput = inputRef.current
        if (queryInput) {
            routes.push(routes.search(queryInput.value))
            queryInput.value = ''
        }
    }

    const showAll = (type: SearchType) => {
        const searchRoute = routes.search(query, type)

        return (
            <TextLink
                className={classes.groupCount}
                href={searchRoute.href}
                as={searchRoute.as}
                onClick={undefined}
            >
                {t('PageHeader.search.showMore')}
            </TextLink>
        )
    }

    const groupHeader = (textKey: string, kind: SearchType, count: number, withLink: boolean) => (
        <div className={classes.groupHeader} data-testid={componentTestIds.search.headerGroup(kind)}>
            <span>{t(textKey)}</span>
            {withLink ? showAll(kind) : <span className={classes.groupCount}>{t('Search.hits', { count })}</span>}
        </div>
    )

    return (
        <form className={classes.wrapper} onSubmit={handleClickSearch}>
            <input
                id={searchInputId}
                placeholder={t('PageHeader.search.placeholder')}
                className={classes.searchInput}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                ref={inputRef}
            />
            <button type="submit" className={classes.searchButton}>
                <IconSearch />
            </button>
            {searchActive && focused && (
                <div className={classes.results} onFocus={handleFocus} data-testid={componentTestIds.search.headerResults}>
                    {!haveResults && (
                        <div className={classes.resultsText}>
                            {searchResult.loading ? (
                                <IconLoading className={classes.iconLoading} />
                            ) : (
                                t('GameDetail.noSearchResults')
                            )}
                        </div>
                    )}
                    {haveResults && result && (
                        <>
                            {result.games.length > 0 && (
                                <>
                                    {groupHeader('Search.tabGames', 'games', result.totalGames, true)}
                                    {result.games.slice(0, MAX_RESULTS_PER_KIND).map((game, n) => (
                                        <GameBaseDataPanel
                                            key={game.id}
                                            game={game}
                                            className={classNames({
                                                [classes.gameSpacer]: n > 0,
                                                [classes.gameLoading]: loadingWithData,
                                            })}
                                            variant="dark"
                                        />
                                    ))}
                                </>
                            )}
                            {result.users.length > 0 && (
                                <>
                                    {groupHeader('Search.tabUsers', 'users', result.totalUsers, true)}
                                    {result.users.slice(0, MAX_RESULTS_PER_KIND).map(user => (
                                        <div className={classes.person} key={user.id}>
                                            <UserLink userId={user.id}>
                                                <HighlightedText text={user.name} query={query} />
                                            </UserLink>
                                            {user.nickname ? (
                                                <span className={classes.personMeta}>
                                                    {' '}
                                                    <HighlightedText text={user.nickname} query={query} />
                                                </span>
                                            ) : null}
                                        </div>
                                    ))}
                                </>
                            )}
                            {result.events.length > 0 && (
                                <>
                                    {groupHeader('Search.tabEvents', 'events', result.totalEvents, true)}
                                    {result.events.slice(0, MAX_RESULTS_PER_KIND).map(event => (
                                        <div className={classes.person} key={event.id}>
                                            <EventLink event={event}>
                                                <HighlightedText text={event.name} query={query} />
                                            </EventLink>
                                            <span className={classes.personMeta}>
                                                {formatDate(toEventDate(event.from) ?? new Date())}
                                                {event.loc ? ` · ${event.loc}` : ''}
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}
                            {result.groups.length > 0 && (
                                <>
                                    {groupHeader('Search.tabGroups', 'groups', result.totalGroups, true)}
                                    {result.groups.slice(0, MAX_RESULTS_PER_KIND).map(group => (
                                        <div className={classes.person} key={group.id}>
                                            <TextLink
                                                href={routes.groupDetail(group.id).href}
                                                as={routes.groupDetail(group.id).as}
                                            >
                                                <HighlightedText text={group.name} query={query} />
                                            </TextLink>
                                        </div>
                                    ))}
                                </>
                            )}
                        </>
                    )}
                    {!searchResult.loading && result?.suggestion && (
                        <div className={classes.suggestion}>
                            {t('Search.didYouMean')}{' '}
                            <button
                                type="button"
                                className={classes.suggestionLink}
                                onClick={() => {
                                    setQuery(result.suggestion as string)
                                }}
                            >
                                {result.suggestion}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </form>
    )
}
