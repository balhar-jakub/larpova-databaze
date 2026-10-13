import React from 'react'
import { NextPage } from 'next'
import StatisticsPanel from '../../src/components/Statistics/StatisticsPanel'

interface Props {}
interface InitialProps {}

/**
 * Statistics: how the scene and its ratings changed year by year. Static page
 * with no URL state — the filters of the catalog/calendar do not apply to
 * history over the whole database.
 */
const StatisticsPage: NextPage<Props, InitialProps> = () => {
    return <StatisticsPanel />
}

StatisticsPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default StatisticsPage
