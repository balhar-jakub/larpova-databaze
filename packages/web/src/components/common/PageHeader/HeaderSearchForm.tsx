import React, { ChangeEvent, FormEvent, useRef, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@apollo/client'
import classNames from 'classnames'
import { darkTheme } from '../../../theme/darkTheme'
import { IconLoading, IconSearch } from '../Icons/Icons'
import {
    BaseGameDataFragment,
    SearchGamesQuery,
    SearchGamesQueryVariables,
} from '../../../graphql/__generated__/typescript-operations'
import { GameBaseDataPanel } from '../GameBaseDataPanel/GameBaseDataPanel'
import { useRoutes } from '../../../hooks/useRoutes'
import { TextLink } from '../TextLink/TextLink'
import { breakPoints } from '../../../theme/breakPoints'

export const searchInputId = 'headerSearchInput'

const searchGamesQuery = require('./graphql/searchGamesQuery.graphql')

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
    },
    resultsText: {
        padding: '10px 5px',
        alignSelf: 'center',
        color: darkTheme.text,
        fontSize: '0.75rem',
    },
    moreText: {
        padding: '15px 5px 10px',
        alignSelf: 'center',
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
    [`@media(min-width: ${breakPoints.md}px)`]: {
        searchInput: {
            width: 150,
        },
        wrapper: {
            marginBottom: 0,
        },
    },
})

const MAX_RESULTS = 6
const MIN_SEARCH_LENGTH = 3
const BLUR_TIMEOUT = 100
const CHANGE_TIMEOUT = 500

export const HeaderSearchForm = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [query, setQuery] = useState('')
    const [focused, setFocused] = useState(false)
    const hideTimeoutRef = useRef(0)
    const changeTimeoutRef = useRef(0)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const lastGames = useRef<BaseGameDataFragment[]>([])
    const routes = useRoutes()
    const searchActive = query.length >= 3
    const searchResult = useQuery<SearchGamesQuery, SearchGamesQueryVariables>(searchGamesQuery, {
        variables: {
            query,
            limit: MAX_RESULTS,
        },
        fetchPolicy: 'cache-and-network',
        skip: !searchActive,
    })

    const games = searchResult.data?.games.byQuery || lastGames.current
    lastGames.current = games
    const haveGames = games && games.length > 0
    const loadingWithData = haveGames && searchResult.loading

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

    const moreRoute = routes.search(inputRef.current?.value)

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
                <div className={classes.results} onFocus={handleFocus}>
                    {!haveGames && (
                        <div className={classes.resultsText}>
                            {searchResult.loading ? (
                                <IconLoading className={classes.iconLoading} />
                            ) : (
                                t('GameDetail.noSearchResults')
                            )}
                        </div>
                    )}
                    {haveGames &&
                        games?.map((game, n) => {
                            if (n < 5) {
                                // Game
                                const gameClasses = classNames({
                                    [classes.gameSpacer]: n > 0,
                                    [classes.gameLoading]: loadingWithData,
                                })
                                return (
                                    <GameBaseDataPanel
                                        key={game.id}
                                        game={game}
                                        className={gameClasses}
                                        variant="dark"
                                    />
                                )
                            }

                            // Show "more" link instead of the game
                            return (
                                <div className={classes.moreText} key="more">
                                    <TextLink href={moreRoute.href} as={moreRoute.as}>
                                        {t('PageHeader.search.showMore')}
                                    </TextLink>
                                </div>
                            )
                        })}
                </div>
            )}
        </form>
    )
}
