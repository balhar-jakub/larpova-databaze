import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { useRoutes } from '../../hooks/useRoutes'
import { componentTestIds } from '../componentTestIds'
import HighlightedText from './HighlightedText'
import { GroupRowData } from './searchHelpers'

interface Props {
    readonly group: GroupRowData
    readonly query?: string | null
}

const useStyles = createUseStyles({
    row: {
        display: 'grid',
        gridTemplateColumns: '56px 1fr 150px',
        gap: 12,
        alignItems: 'center',
        background: darkTheme.backgroundRealWhite,
        borderRadius: 6,
        padding: '9px 14px',
        marginBottom: 7,
        color: darkTheme.textOnLightDark,
    },
    mark: {
        width: 48,
        height: 48,
        borderRadius: 6,
        background: darkTheme.backgroundNearWhite,
        color: darkTheme.blue,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.3rem',
        fontWeight: 700,
    },
    name: {
        fontSize: '1rem',
        fontWeight: 600,
    },
    meta: {
        fontSize: '0.74rem',
        color: darkTheme.textOnLightLighter,
        marginTop: 2,
    },
    link: {
        fontSize: '0.72rem',
        textAlign: 'right',
    },
})

/**
 * A group authors games, so a group is a way into the database: the header
 * search could always find one, the search page never listed one at all.
 */
export const SearchGroupRow = ({ group, query }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const routes = useRoutes()
    const count = group.authorsOf?.length ?? 0

    return (
        <div className={classes.row} data-testid={componentTestIds.search.groupRow(group.id)}>
            <div className={classes.mark}>S</div>
            <div>
                <div className={classes.name}>
                    <HighlightedText text={group.name} query={query} />
                </div>
                <div className={classes.meta}>{t('Search.groupGames', { count })}</div>
            </div>
            <div className={classes.link}>
                <a href={routes.groupDetail(group.id).as} className={classes.link}>
                    {t('Search.groupGamesLink')}
                </a>
            </div>
        </div>
    )
}

export default SearchGroupRow
