import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { componentTestIds } from '../componentTestIds'
import { SearchType } from './searchHelpers'

interface Props {
    readonly type: SearchType
    readonly label: string
    /** Results of this kind in total — the "zobrazit všech N" label. */
    readonly count: number
    /** Says how many results the kind has / how many the block above shows. */
    readonly info?: string
    readonly expanded: boolean
    readonly onToggle: () => void
}

const useStyles = createUseStyles({
    bar: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        background: darkTheme.backgroundLight,
        border: `1px solid ${darkTheme.backgroundControl}`,
        borderRadius: 6,
        padding: '11px 14px',
        marginBottom: 7,
    },
    name: {
        fontSize: '0.95rem',
        fontWeight: 700,
        color: darkTheme.textLight,
    },
    info: {
        fontSize: '0.74rem',
        color: darkTheme.textDark,
    },
    link: {
        marginLeft: 'auto',
        background: 'transparent',
        border: 0,
        padding: 0,
        color: darkTheme.textGreen,
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: 'pointer',
    },
})

/**
 * One kind of result, collapsed: how many results it has, how many of them the
 * "Nejlepší shody" block above already shows, and a way to open the whole list
 * on the spot. A tab would have thrown the visitor onto a different page with
 * the other three kinds hidden.
 */
export const SearchSectionHeader = ({ type, label, count, info, expanded, onToggle }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <div className={classes.bar} data-testid={componentTestIds.search.sectionBar(type)}>
            <span className={classes.name}>{label}</span>
            {info && <span className={classes.info}>{info}</span>}
            {count > 0 && (
                <button
                    type="button"
                    className={classes.link}
                    onClick={onToggle}
                    data-testid={
                        expanded ? componentTestIds.search.collapse(type) : componentTestIds.search.showAll(type)
                    }
                >
                    {expanded ? t('Search.collapseSection') : t('Search.seeAll', { count })}
                </button>
            )}
        </div>
    )
}

export default SearchSectionHeader
