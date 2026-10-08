import React, { useEffect, useRef, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { Form as FinalForm } from 'react-final-form'
import type { FormApi } from 'final-form'
import { useTranslation } from 'src/lib/i18n'
import { Button } from 'react-bootstrap'
import { useRouter } from 'next/router'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { darkTheme } from '../../theme/darkTheme'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import FormTextInputField from '../common/form/FormTextInputField'
import GamesSearchPanel from './GamesSearchPanel'
import { useFocusInput } from '../../hooks/useFocusInput'
import UserSearchPanel from './UserSearchPanel'
import EventsSearchPanel from './EventsSearchPanel'
import { MIN_MATCH_QUERY_LENGTH } from '../../utils/textUtils'
import { componentTestIds } from '../componentTestIds'

interface Props {
    readonly initialQuery?: string
    readonly initialTab?: string
}

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
})

type SearchTab = 'games' | 'users' | 'events'

const SEARCH_TABS: SearchTab[] = ['games', 'users', 'events']

const isSearchTab = (value: unknown): value is SearchTab =>
    SEARCH_TABS.includes(value as SearchTab)

const tabDefs: TabDefinition<SearchTab>[] = [
    {
        key: 'games',
        title: { key: 'Search.tabGames' },
    },
    {
        key: 'users',
        title: { key: 'Search.tabUsers' },
    },
    {
        key: 'events',
        title: { key: 'Search.tabEvents' },
    },
]

interface FormValues {
    readonly query?: string
}

/**
 * The search page. One query, three tabs (games, people, events) and the query
 * in the URL (`/search?q=novak&t=users`), so a result can be linked to, shared
 * or reloaded, and the tab a visitor picked survives the reload.
 */
const SearchPanel = ({ initialQuery, initialTab }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const router = useRouter()
    const requestedTab = isSearchTab(initialTab) ? initialTab : 'games'
    const [selectedTab, setSelectedTab] = useState<SearchTab>(requestedTab)
    const [query, setQuery] = useState(initialQuery || '')
    const formRef = useFocusInput<HTMLFormElement>('query')
    const formApiRef = useRef<FormApi<FormValues> | null>(null)

    useEffect(() => {
        setQuery(initialQuery || '')
        setSelectedTab(requestedTab)

        /* We get here on (after) first render when when header search field is resubmitted - reset some state */

        // Focus query
        const element = formRef.current?.getElementsByTagName('input').namedItem('query')
        element?.focus()
    }, [initialQuery, requestedTab, formRef])

    // Accepting a suggestion rewrites the query — keep the input in sync with it.
    useEffect(() => {
        const form = formApiRef.current
        if (form && form.getFieldState('query')?.value !== query) {
            form.change('query', query)
        }
    }, [query])

    const updateUrl = (nextQuery: string, tab: SearchTab) => {
        router.replace(
            {
                pathname: router.pathname,
                query: {
                    ...(nextQuery ? { q: nextQuery } : {}),
                    ...(tab === 'games' ? {} : { t: tab }),
                },
            },
            undefined,
            { shallow: true },
        )
    }

    const handleSearch = (values: FormValues) => {
        const nextQuery = (values.query || '').trim()
        setQuery(nextQuery)
        updateUrl(nextQuery, selectedTab)
    }

    const handleSelectTab = (tab: SearchTab) => {
        setSelectedTab(tab)
        if (query) {
            updateUrl(query, tab)
        }
    }

    const handleUseSuggestion = (suggestion: string) => {
        setQuery(suggestion)
        updateUrl(suggestion, selectedTab)
    }

    const tooShort = query.trim().length > 0 && query.trim().length < MIN_MATCH_QUERY_LENGTH

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
            <div data-testid={componentTestIds.search.tabs}>
                <Tabs<SearchTab> selectedTab={selectedTab} onSelectTab={handleSelectTab} tabs={tabDefs} />
            </div>
            <div className={classes.contents} data-testid={componentTestIds.search.panel}>
                <WidthFixer>
                    {!query.trim() && <span className={classes.notice}>{t('Search.enterQuery')}</span>}
                    {tooShort && (
                        <span className={classes.notice} data-testid={componentTestIds.search.tooShort}>
                            {t('Search.tooShort', { count: MIN_MATCH_QUERY_LENGTH })}
                        </span>
                    )}
                    {!tooShort && !!query.trim() && selectedTab === 'games' && (
                        <GamesSearchPanel query={query} onUseSuggestion={handleUseSuggestion} />
                    )}
                    {!tooShort && !!query.trim() && selectedTab === 'users' && (
                        <UserSearchPanel query={query} onUseSuggestion={handleUseSuggestion} />
                    )}
                    {!tooShort && !!query.trim() && selectedTab === 'events' && (
                        <EventsSearchPanel query={query} onUseSuggestion={handleUseSuggestion} />
                    )}
                </WidthFixer>
            </div>
        </>
    )
}

export default SearchPanel
