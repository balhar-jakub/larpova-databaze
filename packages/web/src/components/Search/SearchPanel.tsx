import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { Form as FinalForm } from 'react-final-form'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { darkTheme } from '../../theme/darkTheme'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import FormTextInputField from '../common/form/FormTextInputField'
import GamesSearchPanel from './GamesSearchPanel'
import { useFocusInput } from '../../hooks/useFocusInput'
import UserSearchPanel from './UserSearchPanel'

interface Props {
    readonly initialQuery?: string
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
})

type SearchTab = 'games' | 'users'

const tabDefs: TabDefinition<SearchTab>[] = [
    {
        key: 'games',
        title: { key: 'Search.tabGames' },
    },
    {
        key: 'users',
        title: { key: 'Search.tabUsers' },
    },
]

interface FormValues {
    readonly query?: string
}

const SearchPanel = ({ initialQuery }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [selectedTab, setSelectedTab] = useState<SearchTab>('games')
    const [query, setQuery] = useState(initialQuery || '')
    const formRef = useFocusInput<HTMLFormElement>('query')

    useEffect(() => {
        setQuery(initialQuery || '')

        /* We get here on (after) first render when when header search field is resubmitted - reset some state */

        // Focus query
        const element = formRef.current?.getElementsByTagName('input').namedItem('query')
        element?.focus()

        setSelectedTab('games')
    }, [initialQuery, formRef])

    const handleSearch = (values: FormValues) => {
        setQuery(values.query || '')
    }

    return (
        <>
            <FinalForm onSubmit={handleSearch} initialValues={{ query: initialQuery || '' }}>
                {({ handleSubmit }) => (
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
                )}
            </FinalForm>
            <Tabs<SearchTab> selectedTab={selectedTab} onSelectTab={setSelectedTab} tabs={tabDefs} />
            <div className={classes.contents}>
                <WidthFixer>
                    {!query && t('Search.enterQuery')}
                    {!!query && selectedTab === 'games' && <GamesSearchPanel query={query} />}
                    {!!query && selectedTab === 'users' && <UserSearchPanel query={query} />}
                </WidthFixer>
            </div>
        </>
    )
}

export default SearchPanel
