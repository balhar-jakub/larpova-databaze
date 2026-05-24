import React from 'react'
import { useTranslation } from 'react-i18next'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import { useRoutes } from '../../hooks/useRoutes'

type Tab = 'profile' | 'settings' | 'changePassword'

interface Props {
    readonly selectedTab: Tab
    readonly profileOnly?: boolean
}

const UserProfileTabs = ({ selectedTab, profileOnly }: Props) => {
    const routes = useRoutes()
    const handleSelectTab = (tab: Tab) => {
        if (tab !== selectedTab) {
            switch (tab) {
                case 'profile':
                    routes.push(routes.currentProfile())
                    break
                case 'settings':
                    routes.push(routes.userSettings())
                    break
                case 'changePassword':
                    routes.push(routes.changePassword())
                    break
                default:
                // Should not happen
            }
        }
    }
    const { t } = useTranslation('common')

    const tabs: Array<TabDefinition<Tab>> = [
        {
            key: 'profile',
            title: t('UserDetail.profile'),
        },
    ]
    if (!profileOnly) {
        tabs.push({
            key: 'settings',
            title: t('UserDetail.settings'),
        })
        tabs.push({
            key: 'changePassword',
            title: t('UserDetail.changePassword'),
        })
    }

    return <Tabs selectedTab={selectedTab} tabs={tabs} onSelectTab={handleSelectTab} />
}

export default UserProfileTabs
