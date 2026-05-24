import React from 'react'
import { useTranslation } from 'react-i18next'
import { createUseStyles } from 'react-jss'
import AdminTabs from './AdminTabs'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '100px 0 120px',
    },
})

const AdminMenuPanel = () => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    return (
        <>
            <AdminTabs selectedTab="intro" />
            <div className={classes.row}>
                <WidthFixer>
                    <h1>{t('Admin.intro')}</h1>
                </WidthFixer>
            </div>
        </>
    )
}

export default AdminMenuPanel
