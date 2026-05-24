import React, { useMemo } from 'react'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import { useLoggedInUser } from '../../hooks/useLoggedInUser'
import { UserRole } from '../../graphql/__generated__/typescript-operations'
import { useRoutes } from '../../hooks/useRoutes'

type AdminTab = 'intro' | 'users' | 'labels' | 'stats' | 'selfRated'

interface Props {
    readonly selectedTab: AdminTab
}

const tabs: Array<TabDefinition<AdminTab>> = [
    {
        key: 'intro',
        title: { key: 'Admin.tabIntro' },
    },
    {
        key: 'users',
        title: { key: 'Admin.tabUsers' },
    },
    {
        key: 'labels',
        title: { key: 'Admin.tabLabels' },
    },
    {
        key: 'stats',
        title: { key: 'Admin.tabStats' },
    },
    {
        key: 'selfRated',
        title: { key: 'Admin.tabSelfRating' },
    },
]

const AdminTabs = ({ selectedTab }: Props) => {
    const routes = useRoutes()
    const loggedInUserRole = useLoggedInUser()?.role
    // Do not show some tabs (users) to non-admins
    const filteredTabs = useMemo(
        () => (loggedInUserRole === UserRole.Admin ? tabs : tabs.filter(({ key }) => key !== 'users')),
        [loggedInUserRole],
    )

    const handleSelect = (tab: AdminTab) => {
        if (tab === 'intro') {
            routes.push(routes.adminIntro())
        }
        if (tab === 'users') {
            routes.push(routes.adminUsers())
        }
        if (tab === 'labels') {
            routes.push(routes.adminLabels())
        }
        if (tab === 'stats') {
            routes.push(routes.adminStats())
        }
        if (tab === 'selfRated') {
            routes.push(routes.adminSelfRated())
        }
    }

    return <Tabs tabs={filteredTabs} selectedTab={selectedTab} onSelectTab={handleSelect} />
}

export default AdminTabs
