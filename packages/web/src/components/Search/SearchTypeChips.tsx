import React from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { componentTestIds } from '../componentTestIds'
import { SEARCH_TYPES, SearchType } from './searchHelpers'

interface Props {
    readonly counts: Partial<Record<SearchType, number>>
    /** `undefined` = all kinds in one list. */
    readonly selected?: SearchType
    readonly onSelect: (type?: SearchType) => void
}

const LABEL_KEY: Record<SearchType, string> = {
    games: 'Search.tabGames',
    users: 'Search.tabUsers',
    events: 'Search.tabEvents',
    groups: 'Search.tabGroups',
}

const useStyles = createUseStyles({
    wrapper: {
        background: darkTheme.backgroundLight,
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 12,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
    },
    label: {
        fontSize: '0.72rem',
        color: darkTheme.textDark,
        marginRight: 4,
    },
    chip: {
        border: `1px solid ${darkTheme.backgroundControl}`,
        background: darkTheme.background,
        color: darkTheme.text,
        borderRadius: 12,
        padding: '3px 12px',
        fontSize: '0.78rem',
        cursor: 'pointer',
    },
    chipActive: {
        background: '#1d3f42',
        borderColor: darkTheme.textGreen,
        color: darkTheme.textGreen,
        fontWeight: 700,
    },
    count: {
        marginLeft: 6,
        fontWeight: 700,
    },
})

/**
 * The four kinds of result as a filter, not as tabs: the count of every kind is
 * on its chip (with tabs you had to click through them to learn that the query
 * has 153 events), and picking one narrows the page in place instead of leaving
 * it — the query and the picked kind both stay in the URL, so the result can
 * still be linked and reloaded.
 */
export const SearchTypeChips = ({ counts, selected, onSelect }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const total = SEARCH_TYPES.reduce((sum, type) => sum + (counts[type] ?? 0), 0)

    const chip = (type: SearchType | undefined, label: string, count: number) => (
        <button
            type="button"
            key={type ?? 'all'}
            className={classNames({ [classes.chip]: true, [classes.chipActive]: selected === type })}
            onClick={() => onSelect(type)}
            data-testid={componentTestIds.search.typeChip(type ?? 'all')}
            aria-pressed={selected === type}
        >
            {label}
            <span className={classes.count}>{count}</span>
        </button>
    )

    return (
        <div className={classes.wrapper}>
            <span className={classes.label}>{t('Search.typesLabel')}</span>
            {chip(undefined, t('Search.allTypes'), total)}
            {SEARCH_TYPES.map(type => chip(type, t(LABEL_KEY[type]), counts[type] ?? 0))}
        </div>
    )
}

export default SearchTypeChips
