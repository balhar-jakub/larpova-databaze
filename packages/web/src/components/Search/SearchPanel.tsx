import React, { useEffect, useRef, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { Form as FinalForm } from 'react-final-form'
import type { FormApi } from 'final-form'
import { useTranslation } from 'src/lib/i18n'
import { Button } from 'react-bootstrap'
import { useRouter } from 'next/router'
import { useQuery } from '@apollo/client'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { darkTheme } from '../../theme/darkTheme'
import FormTextInputField from '../common/form/FormTextInputField'
import GamesSearchPanel from './GamesSearchPanel'
import GroupsSearchPanel from './GroupsSearchPanel'
import { useFocusInput } from '../../hooks/useFocusInput'
import UserSearchPanel from './UserSearchPanel'
import EventsSearchPanel from './EventsSearchPanel'
import SearchGameRow from './SearchGameRow'
import SearchPersonRow from './SearchPersonRow'
import SearchEventRow from './SearchEventRow'
import SearchGroupRow from './SearchGroupRow'
import SearchSectionHeader from './SearchSectionHeader'
import SearchSuggestion from './SearchSuggestion'
import SearchTypeChips from './SearchTypeChips'
import BigLoading from '../common/BigLoading/BigLoading'
import { MIN_MATCH_QUERY_LENGTH } from '../../utils/textUtils'
import { componentTestIds } from '../componentTestIds'
import {
    GameRowData,
    GroupRowData,
    PersonRowData,
    EventRowData,
    SEARCH_TYPES,
    SearchType,
    bestMatches,
    searchGamesState,
    searchPageQuery,
    searchTypeFromParam,
} from './searchHelpers'
import { CatalogState, clearCatalogFilters } from '../Catalog/catalogState'
import {
    SearchOverviewQuery,
    SearchOverviewQueryVariables,
} from '../../graphql/__generated__/typescript-operations'

const searchOverviewGql = require('./graphql/searchOverview.graphql')

interface Props {
    readonly initialQuery?: string
    /** The `typ=` of the URL — the kind a visitor filtered the page to. */
    readonly initialType?: string
}

/** How many rows of every kind the "Nejlepší shody" block shows. */
const BEST_MATCH_SIZE = 3

const useStyles = createUseStyles({
    form: {
        background: darkTheme.background,
        padding: '20px 0',
    },
    contents: {
        background: darkTheme.backgroundWhite,
        padding: '20px 0',
    },
    formRow: {
        display: 'flex',
        alignItems: 'flex-start',
    },
    textField: {
        flex: 1,
        marginRight: 12,
    },
    example: {
        color: darkTheme.text,
        fontSize: '0.75rem',
        margin: 0,
    },
    notice: {
        color: darkTheme.text,
        padding: '5px 0',
    },
    summary: {
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: 10,
        background: darkTheme.backgroundLight,
        borderRadius: 6,
        padding: '10px 14px',
        marginBottom: 10,
    },
    summaryQuery: {
        fontSize: '1.05rem',
        fontWeight: 700,
        color: darkTheme.textLight,
    },
    clear: {
        background: 'transparent',
        border: 0,
        color: darkTheme.textDark,
        cursor: 'pointer',
        fontSize: '1rem',
        lineHeight: 1,
        padding: '0 2px',
    },
    legend: {
        marginLeft: 'auto',
        fontSize: '0.72rem',
        color: darkTheme.textDark,
        textAlign: 'right',
    },
    blockTitle: {
        fontSize: '0.8rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: darkTheme.textDark,
        margin: '14px 0 8px',
    },
    blockHint: {
        fontSize: '0.72rem',
        fontWeight: 400,
        letterSpacing: 0,
        textTransform: 'none',
        color: darkTheme.textOnLightLighter,
        marginLeft: 8,
    },
    empty: {
        background: darkTheme.backgroundLight,
        borderRadius: 6,
        padding: '16px 18px',
        color: darkTheme.textLight,
        fontSize: '0.85rem',
    },
    emptyLinks: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    emptyLink: {
        background: darkTheme.background,
        border: `1px solid ${darkTheme.backgroundControl}`,
        borderRadius: 12,
        color: darkTheme.text,
        cursor: 'pointer',
        fontSize: '0.78rem',
        padding: '3px 12px',
    },
})

interface FormValues {
    readonly query?: string
}

/**
 * The search page: one query, all four kinds of result on one page.
 *
 * The four kinds used to be tabs, so the counts of three of them were invisible
 * until the visitor clicked through them, and a tab switch threw the list away.
 * Here the counts sit on chips (a chip narrows the page in place), the best
 * three rows of every kind open the page in a block of their own — measured on
 * production, a single ranking would leave the first 25-strong page to whichever
 * kind happens to have the most rows (for `larp` 24 events and no game, for
 * `novak` 25 games before the first person) — and every kind has its whole list
 * one click away. The query and the picked kind live in the URL
 * (`/search?q=novak&typ=lide`), so a result can be linked and reloaded.
 */
const SearchPanel = ({ initialQuery, initialType }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const router = useRouter()
    const [query, setQuery] = useState(initialQuery || '')
    const [selectedType, setSelectedType] = useState<SearchType | undefined>(searchTypeFromParam(initialType))
    // The games section brings the catalog's facets and rankings along; the state
    // lives in this page's URL next to the query, so a filtered list is a link.
    const [gamesState, setGamesState] = useState<CatalogState>(() => searchGamesState(router.query))
    const formRef = useFocusInput<HTMLFormElement>('query')
    const formApiRef = useRef<FormApi<FormValues> | null>(null)

    const trimmed = query.trim()
    const tooShort = trimmed.length > 0 && trimmed.length < MIN_MATCH_QUERY_LENGTH
    const asked = trimmed.length >= MIN_MATCH_QUERY_LENGTH

    const { data, loading } = useQuery<SearchOverviewQuery, SearchOverviewQueryVariables>(searchOverviewGql, {
        variables: { query: trimmed, limit: BEST_MATCH_SIZE },
        skip: !asked,
    })

    useEffect(() => {
        setQuery(initialQuery || '')
        setSelectedType(searchTypeFromParam(initialType))

        /* We get here on (after) first render when when header search field is resubmitted - reset some state */

        // Focus query
        const element = formRef.current?.getElementsByTagName('input').namedItem('query')
        element?.focus()
    }, [initialQuery, initialType, formRef])

    // Accepting a suggestion rewrites the query — keep the input in sync with it.
    useEffect(() => {
        const form = formApiRef.current
        if (form && form.getFieldState('query')?.value !== query) {
            form.change('query', query)
        }
    }, [query])

    const updateUrl = (nextQuery: string, type?: SearchType, nextGamesState: CatalogState = gamesState) => {
        router.replace(
            {
                pathname: router.pathname,
                query: searchPageQuery(nextQuery, type, nextGamesState),
            },
            undefined,
            { shallow: true },
        )
    }

    /**
     * The games section edits the catalog state. Its own filter panel carries the
     * search text too — one query, one input — so a text change goes to the page.
     */
    const handleGamesStateChange = (patch: Partial<CatalogState>) => {
        if ('query' in patch) {
            const nextQuery = patch.query ?? ''
            setQuery(nextQuery)
            updateUrl(nextQuery, selectedType)
        }

        const { query: _query, ...rest } = patch
        if (Object.keys(rest).length > 0) {
            const nextState = { ...gamesState, ...rest }
            setGamesState(nextState)
            updateUrl(query, selectedType, nextState)
        }
    }

    const handleGamesReset = () => {
        const nextState = clearCatalogFilters(gamesState)
        setGamesState(nextState)
        updateUrl(query, selectedType, nextState)
    }

    const handleSearch = (values: FormValues) => {
        const nextQuery = (values.query || '').trim()
        setQuery(nextQuery)
        updateUrl(nextQuery, selectedType)
    }

    const handleSelectType = (type?: SearchType) => {
        setSelectedType(type)
        if (query) {
            updateUrl(query, type)
        }
    }

    const handleUseSuggestion = (suggestion: string) => {
        setQuery(suggestion)
        updateUrl(suggestion, selectedType)
    }

    const handleClearQuery = () => {
        setQuery('')
        updateUrl('', selectedType)
    }

    const overview = data?.search
    const counts: Record<SearchType, number> = {
        games: overview?.totalGames ?? 0,
        users: overview?.totalUsers ?? 0,
        events: overview?.totalEvents ?? 0,
        groups: overview?.totalGroups ?? 0,
    }
    const total = SEARCH_TYPES.reduce((sum, type) => sum + counts[type], 0)

    const renderRow = (type: SearchType, item: unknown) => {
        // Ids are unique inside a kind, not across kinds: game 3 and event 3 both
        // exist, and the interleaved block puts them side by side.
        const id = (item as { id: string }).id

        switch (type) {
            case 'games':
                return <SearchGameRow game={item as GameRowData} query={trimmed} key={`games-${id}`} />
            case 'users':
                return <SearchPersonRow person={item as PersonRowData} query={trimmed} key={`users-${id}`} />
            case 'events':
                return <SearchEventRow event={item as EventRowData} query={trimmed} key={`events-${id}`} />
            default:
                return <SearchGroupRow group={item as GroupRowData} query={trimmed} key={`groups-${id}`} />
        }
    }

    const typeLabel = (type: SearchType) =>
        t(
            type === 'games'
                ? 'Search.tabGames'
                : type === 'users'
                  ? 'Search.tabUsers'
                  : type === 'events'
                    ? 'Search.tabEvents'
                    : 'Search.tabGroups',
        )

    const emptyLinks = (
        <div className={classes.emptyLinks}>
            {SEARCH_TYPES.map(type => (
                <button
                    key={type}
                    type="button"
                    className={classes.emptyLink}
                    onClick={() => handleSelectType(type)}
                    disabled={counts[type] === 0}
                    data-testid={componentTestIds.search.emptyLink(type)}
                >
                    {typeLabel(type)} {counts[type]}
                </button>
            ))}
        </div>
    )

    return (
        <>
            <FinalForm onSubmit={handleSearch} initialValues={{ query: initialQuery || '' }}>
                {({ handleSubmit, form }) => {
                    formApiRef.current = form

                    return (
                        <form className={classes.form} onSubmit={handleSubmit} ref={formRef}>
                            <WidthFixer>
                                <div className={classes.formRow}>
                                    <FormTextInputField
                                        className={classes.textField}
                                        name="query"
                                        placeholder={t('Search.query')}
                                        hint={t('Search.queryHint')}
                                        showErrorPlaceholder={false}
                                    />
                                    <Button type="submit" variant="light">
                                        {t('Search.searchButton')}
                                    </Button>
                                </div>
                                {/* eslint-disable-next-line react/no-danger */}
                                <p className={classes.example} dangerouslySetInnerHTML={{ __html: t('Search.example1') }} />
                                {/* eslint-disable-next-line react/no-danger */}
                                <p className={classes.example} dangerouslySetInnerHTML={{ __html: t('Search.example2') }} />
                                {/* eslint-disable-next-line react/no-danger */}
                                <p className={classes.example} dangerouslySetInnerHTML={{ __html: t('Search.example3') }} />
                            </WidthFixer>
                        </form>
                    )
                }}
            </FinalForm>
            <div className={classes.contents} data-testid={componentTestIds.search.panel}>
                <WidthFixer>
                    {!trimmed && <span className={classes.notice}>{t('Search.enterQuery')}</span>}
                    {tooShort && (
                        <span className={classes.notice} data-testid={componentTestIds.search.tooShort}>
                            {t('Search.tooShort', { count: MIN_MATCH_QUERY_LENGTH })}
                        </span>
                    )}
                    {asked && !overview && <BigLoading />}
                    {asked && overview && (
                        <>
                            <div className={classes.summary}>
                                <span className={classes.summaryQuery}>
                                    {t('Search.resultsFor', { query: trimmed })}
                                </span>
                                <button
                                    type="button"
                                    className={classes.clear}
                                    onClick={handleClearQuery}
                                    title={t('Search.clearQuery')}
                                    data-testid={componentTestIds.search.clearQuery}
                                >
                                    ×
                                </button>
                                <span className={classes.legend}>{t('Search.legend')}</span>
                            </div>
                            <SearchTypeChips counts={counts} selected={selectedType} onSelect={handleSelectType} />
                            {total === 0 && (
                                <>
                                    <SearchSuggestion suggestion={overview.suggestion} onUse={handleUseSuggestion} />
                                    <div className={classes.empty} data-testid={componentTestIds.search.empty}>
                                        {t('Search.notFound')}
                                    </div>
                                </>
                            )}
                            {total > 0 && selectedType === undefined && (
                                <>
                                    <div className={classes.blockTitle}>
                                        {t('Search.bestMatches')}
                                        <span className={classes.blockHint}>{t('Search.bestMatchesHint')}</span>
                                    </div>
                                    {bestMatches<unknown>(
                                        {
                                            games: overview.games,
                                            users: overview.users,
                                            events: overview.events,
                                            groups: overview.groups,
                                        },
                                        BEST_MATCH_SIZE,
                                    ).map(({ type, item }) => renderRow(type, item))}
                                    <div className={classes.blockTitle}>
                                        {t('Search.moreResults')}
                                        <span className={classes.blockHint}>{t('Search.moreResultsHint')}</span>
                                    </div>
                                    {SEARCH_TYPES.map(type => (
                                        <SearchSectionHeader
                                            key={type}
                                            type={type}
                                            label={typeLabel(type)}
                                            count={counts[type]}
                                            info={
                                                counts[type] === 0
                                                    ? t('Search.typeEmpty')
                                                    : t('Search.shownAbove', {
                                                          count: counts[type],
                                                          shown: Math.min(counts[type], BEST_MATCH_SIZE),
                                                      })
                                            }
                                            expanded={false}
                                            onToggle={() => handleSelectType(type)}
                                        />
                                    ))}
                                </>
                            )}
                            {total > 0 && selectedType !== undefined && (
                                <>
                                    <SearchSectionHeader
                                        type={selectedType}
                                        label={typeLabel(selectedType)}
                                        count={counts[selectedType]}
                                        expanded
                                        onToggle={() => handleSelectType(undefined)}
                                    />
                                    {counts[selectedType] > 0 ? (
                                        <>
                                            {selectedType === 'games' && (
                                                <GamesSearchPanel
                                                    query={trimmed}
                                                    state={gamesState}
                                                    onStateChange={handleGamesStateChange}
                                                    onReset={handleGamesReset}
                                                />
                                            )}
                                            {selectedType === 'users' && (
                                                <UserSearchPanel query={trimmed} onUseSuggestion={handleUseSuggestion} />
                                            )}
                                            {selectedType === 'events' && (
                                                <EventsSearchPanel query={trimmed} onUseSuggestion={handleUseSuggestion} />
                                            )}
                                            {selectedType === 'groups' && (
                                                <GroupsSearchPanel query={trimmed} totalAmount={counts.groups} />
                                            )}
                                        </>
                                    ) : (
                                        <div
                                            className={classes.empty}
                                            data-testid={componentTestIds.search.emptyType(selectedType)}
                                        >
                                            {t('Search.emptyType')}
                                            <div>{t('Search.emptyTypeHint')}</div>
                                            {emptyLinks}
                                        </div>
                                    )}
                                </>
                            )}
                            {loading && <span />}
                        </>
                    )}
                </WidthFixer>
            </div>
        </>
    )
}

export default SearchPanel
