import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { componentTestIds } from '../componentTestIds'

interface Props {
    /** The corrected query from the API — `null`/missing shows nothing. */
    readonly suggestion?: string | null
    readonly onUse: (suggestion: string) => void
}

const useStyles = createUseStyles({
    wrapper: {
        color: darkTheme.text,
        fontSize: '0.85rem',
        padding: '0 0 12px',
    },
    link: {
        background: 'transparent',
        border: 0,
        padding: 0,
        color: darkTheme.textGreenDark,
        fontWeight: 700,
        cursor: 'pointer',
        textDecoration: 'underline',
    },
})

/**
 * "Mysleli jste…?" — offered when a query found nothing but a word of it is one
 * typo away from something that exists in the database (`bete` → `Bête`).
 * Accepting it re-runs the search with the corrected wording.
 */
export const SearchSuggestion = ({ suggestion, onUse }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    if (!suggestion) {
        return null
    }

    return (
        <div className={classes.wrapper} data-testid={componentTestIds.search.suggestion}>
            {t('Search.didYouMean')}{' '}
            <button type="button" className={classes.link} onClick={() => onUse(suggestion)}>
                {suggestion}
            </button>
        </div>
    )
}

export default SearchSuggestion
