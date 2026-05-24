import React, { useMemo } from 'react'
import { createUseStyles } from 'react-jss'
import { useQuery } from '@apollo/client'
import { Table } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import isInBrowser from 'is-in-browser'
import { darkTheme } from '../../theme/darkTheme'
import AdminTabs from './AdminTabs'
import { LoadStatsQuery, LoadStatsQueryVariables } from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'

const loadStatsGql = require('./graphql/loadStats.graphql')

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0',
        fontSize: '0.85rem',
    },
    table: {
        width: 'auto',
        margin: '0 auto',
    },
    head: {
        wordBreak: 'break-word',
    },
})

const AdminStatsPanel = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const { data } = useQuery<LoadStatsQuery, LoadStatsQueryVariables>(loadStatsGql, {
        skip: !isInBrowser,
        fetchPolicy: 'cache-and-network',
    })

    const stats = data?.admin.stats
    const sortedStats = useMemo(
        () => [...(stats || [])].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month)),

        [stats],
    )

    return (
        <>
            <AdminTabs selectedTab="stats" />
            <div className={classes.row}>
                {!sortedStats.length && <BigLoading />}
                {sortedStats.length && (
                    <WidthFixer>
                        <Table striped bordered size="sm" className={classes.table}>
                            <thead>
                                <tr className={classes.head}>
                                    <th>{t('AdminRatingStats.month')}</th>
                                    <th>{t('AdminRatingStats.numRatings')}</th>
                                    <th>{t('AdminRatingStats.averageRating')}</th>
                                    <th>{t('AdminRatingStats.numComments')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStats.map(fact => (
                                    <tr key={fact.id}>
                                        <td>
                                            {fact.year}&nbsp;/&nbsp;{fact.month < 10 ? `0${fact.month}` : fact.month}
                                        </td>
                                        <td>{fact.numRatings ?? 0}</td>
                                        <td>{fact.averageRating?.toFixed(2)}</td>
                                        <td>{fact.numComments ?? 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </WidthFixer>
                )}
            </div>
        </>
    )
}

export default AdminStatsPanel
