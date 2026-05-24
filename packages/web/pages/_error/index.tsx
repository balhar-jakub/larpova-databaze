import * as React from 'react'
import { NextPage } from 'next'
import { WithTranslation } from 'next-i18next'
import { withTranslation } from 'src/lib/i18n'
import { createUseStyles } from 'react-jss'
import { WidthFixer } from 'src/components/common/WidthFixer/WidthFixer'
import { IconExclamationTriangle } from 'src/components/common/Icons/Icons'
import Link from 'next/link'
import { darkTheme } from '../../src/theme/darkTheme'
import { useRoutes } from '../../src/hooks/useRoutes'

interface ErrorPageProps extends WithTranslation {
    statusCode?: number
}

interface ErrorPageInitialProps {
    namespacesRequired: string[]
}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '100px 0 120px',
        fontSize: '1.5rem',
    },
    link: {
        fontSize: '1rem',
    },
})

const Error: NextPage<ErrorPageProps, ErrorPageInitialProps> = ({ t, statusCode }) => {
    const classes = useStyles()
    const routes = useRoutes()
    const route = routes.homepage()

    return (
        <div className={classes.row}>
            <WidthFixer>
                <IconExclamationTriangle />
                &nbsp;&nbsp;
                {!statusCode || statusCode === 404 ? t('Error.notFound') : t('Error.otherError', { statusCode })}
                <br />
                <br />
                <Link href={route.as} legacyBehavior>
                    {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                    <a className={classes.link}>{t('Error.toHomepage')}</a>
                </Link>
            </WidthFixer>
        </div>
    )
}

Error.getInitialProps = async ({ res, err }) => {
    let statusCode

    if (res) {
        ;({ statusCode } = res)
    } else if (err) {
        ;({ statusCode } = err)
    }

    return {
        namespacesRequired: ['common'],
        statusCode,
    }
}

export default withTranslation('common')(Error)
