import React, { useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useField } from 'react-final-form'
import { useLazyQuery } from '@apollo/client'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import {
    SeriesByQueryQuery,
    SeriesByQueryQueryVariables,
} from '../../graphql/__generated__/typescript-operations'

import * as seriesByQueryDocument from './graphql/seriesByQuery.graphql'

// The webpack loader exports the document as CommonJS, an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as any
const seriesByQueryGql = documentOf(seriesByQueryDocument)

export interface SeriesChoice {
    readonly id?: string
    readonly name: string
    readonly amountOfGames: number | null | undefined
    readonly itemLabel: string
    readonly isNew?: boolean
}

interface Props {
    /** react-final-form field name holding the chosen SeriesChoice (or null). */
    readonly name: string
    readonly placeholder?: string
    readonly hint?: string
}

const useStyles = createUseStyles({
    wrapper: {
        position: 'relative',
        marginBottom: 10,
    },
    input: {
        width: '100%',
        backgroundColor: darkTheme.backgroundControl,
        border: `1px solid #555`,
        borderRadius: 4,
        color: darkTheme.textLight,
        padding: '6px 34px 6px 10px',
        fontSize: '0.85rem',
        outline: 'none',

        '&:focus': {
            borderColor: darkTheme.textGreen,
        },
    },
    menu: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: darkTheme.backgroundLight,
        border: `1px solid ${darkTheme.backgroundControl}`,
        borderRadius: 4,
        zIndex: 30,
        maxHeight: 240,
        overflowY: 'auto',
    },
    item: {
        padding: '6px 10px',
        color: darkTheme.text,
        cursor: 'pointer',
        fontSize: '0.8rem',

        '&:hover': {
            backgroundColor: darkTheme.backgroundHover,
            color: darkTheme.textLight,
        },
    },
    chosen: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backgroundColor: darkTheme.backgroundControl,
        borderRadius: 4,
        padding: '4px 8px',
        color: darkTheme.textLight,
        fontSize: '0.8rem',
        width: 'fit-content',
    },
    remove: {
        background: 'none',
        border: 'none',
        color: darkTheme.text,
        cursor: 'pointer',
        padding: 0,
        fontSize: '0.9rem',
    },
    hint: {
        color: darkTheme.textDark,
        fontSize: '0.7rem',
        marginTop: 4,
    },
})

/**
 * The "Série" field of the game edit form: a single-choice picker over
 * `seriesByQuery`, with "create new by typed name" built in. Chosen series is
 * held as a SeriesChoice in form values; the submit maps it to
 * `setGameSeries` (see GameEditPagePanel).
 */
const SeriesAutoCompleteField = ({ name, placeholder, hint }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [text, setText] = useState('')
    const [open, setOpen] = useState(false)

    const [search, { loading, data }] = useLazyQuery<SeriesByQueryQuery, SeriesByQueryQueryVariables>(
        seriesByQueryGql,
        {
            variables: { query: '' },
            fetchPolicy: 'network-only',
        },
    )
    const { input } = useField<SeriesChoice | null>(name)

    const results = data?.seriesByQuery ?? []

    const handleSearch = (query: string) => {
        setText(query)
        setOpen(true)
        search({ variables: { query } })
    }

    const pick = (choice: SeriesChoice) => {
        input.onChange({ target: { value: choice } })
        setText('')
        setOpen(false)
    }

    const pickNew = () => {
        // No empty guard: the row only renders when text.trim().length >= 2,
        // so there is always a name to create.
        pick({ name: text.trim(), amountOfGames: null, itemLabel: text.trim(), isNew: true })
    }

    const remove = () => {
        input.onChange({ target: { value: null } })
    }

    if (input.value?.id || input.value?.isNew) {
        return (
            <div className={classes.wrapper}>
                <span className={classes.chosen}>
                    {input.value.itemLabel}
                    <button type="button" className={classes.remove} onClick={remove} aria-label="remove">
                        ×
                    </button>
                </span>
                {hint && <div className={classes.hint}>{hint}</div>}
            </div>
        )
    }

    return (
        <div className={classes.wrapper}>
            <input
                className={classes.input}
                placeholder={placeholder}
                value={text}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {open && (
                <div className={classes.menu}>
                    {loading && <div className={classes.item}>{t('AutoComplete.searching')}</div>}
                    {!loading && results.length === 0 && text.length >= 1 && (
                        <div className={classes.item}>{t('AutoComplete.noResults')}</div>
                    )}
                    {results.map(s => (
                        <div
                            key={s.id}
                            className={classes.item}
                            onMouseDown={() =>
                                pick({ id: s.id, name: s.name ?? '', amountOfGames: s.amountOfGames, itemLabel: `${s.name ?? ''} (${s.amountOfGames})` })
                            }
                        >
                            {s.name} ({s.amountOfGames})
                        </div>
                    ))}
                    {text.trim().length >= 2 && (
                        <div className={classes.item} onMouseDown={pickNew}>
                            {t('GameEdit.createSeries')} „{text.trim()}“
                        </div>
                    )}
                </div>
            )}
            {hint && <div className={classes.hint}>{hint}</div>}
        </div>
    )
}

export default SeriesAutoCompleteField
