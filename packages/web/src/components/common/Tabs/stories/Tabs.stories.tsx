import React, { useState } from 'react'
import { TabDefinition, Tabs } from '../Tabs'

export default { title: 'Tabs' }

const tabSingle: Array<TabDefinition<'recent'>> = [
    {
        key: 'recent',
        title: {
            key: 'HomePage.recent',
        },
    },
]

type TabKeys = 'one' | 'two' | 'three'

const tabThree: Array<TabDefinition<TabKeys>> = [
    {
        key: 'one',
        title: 'First',
    },
    {
        key: 'two',
        title: 'Second',
    },
    {
        key: 'three',
        title: 'Third',
    },
]

export const Single = () => <Tabs tabs={tabSingle} selectedTab="recent" />

export const Three = () => {
    const [tab, setTab] = useState<TabKeys>('one')
    return <Tabs tabs={tabThree} selectedTab={tab} onSelectTab={setTab} />
}
