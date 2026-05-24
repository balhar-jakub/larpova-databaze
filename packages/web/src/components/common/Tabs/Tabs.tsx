import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { darkTheme } from '../../../theme/darkTheme'
import { WidthFixer } from '../WidthFixer/WidthFixer'
import { IconCaretUp } from '../Icons/Icons'

export interface TabDefinition<T> {
    readonly key: T
    readonly title: StringOrTranslatable
}

interface Props<T> {
    readonly tabs: Array<TabDefinition<T>>
    readonly selectedTab: T
    readonly onSelectTab?: (selectedTab: T) => void
}

const useStyles = createUseStyles({
    wrapper: {
        backgroundColor: darkTheme.backgroundControl,
        boxShadow: '0px 1px 1px 0 #000',
    },
    widthFixer: {
        display: 'flex',
        minHeight: 49,
        alignItems: 'stretch',
        overflowX: 'auto',
        overflowY: 'hidden',
    },
    tab: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
    },
    tabText: {
        fontSize: '0.9rem',
        fontWeight: 700,
        padding: '10px 5px',
        margin: '0 10px',
        background: 'transparent',
        color: darkTheme.textDark,
        border: 0,
        cursor: 'pointer',
        height: '100%',
    },
    tabTextHover: {
        '&:hover': {
            color: darkTheme.textGreen,
        },
    },
    tabIcon: {
        fontSize: '1.75rem',
        color: darkTheme.backgroundWhite,
        position: 'absolute',
        bottom: -17,
    },
})

export const Tabs = <T extends string | number>({ tabs, selectedTab, onSelectTab }: Props<T>) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const handleSelectTab = (tab: T) => () => onSelectTab?.(tab)

    return (
        <div className={classes.wrapper}>
            <WidthFixer className={classes.widthFixer}>
                {tabs.map(tab => {
                    const active = tab.key === selectedTab
                    const textClassName = classNames({
                        [classes.tabText]: true,
                        [classes.tabTextHover]: onSelectTab && tabs.length > 1,
                    })

                    return (
                        <div className={classes.tab} key={tab.key}>
                            <button type="button" className={textClassName} onClick={handleSelectTab(tab.key)}>
                                {typeof tab.title === 'string' ? tab.title : t(tab.title.key)}
                            </button>
                            {active && (
                                <div className={classes.tabIcon}>
                                    <IconCaretUp />
                                </div>
                            )}
                        </div>
                    )
                })}
            </WidthFixer>
        </div>
    )
}
