import React from 'react'
import { useTranslation } from 'react-i18next'
import isInBrowser from 'is-in-browser'
import { createUseStyles } from 'react-jss'
import { useLoggedInUser } from '../../../hooks/useLoggedInUser'
import SignInPanel from '../../SignIn/SignInPanel'
import { UserRole } from '../../../graphql/__generated__/typescript-operations'
import FormPageRow from '../FormPageRow/FormPageRow'
import { useRoutes } from '../../../hooks/useRoutes'
import { TextLink } from '../TextLink/TextLink'
import { IconBack } from '../Icons/Icons'
import BigLoading from '../BigLoading/BigLoading'
import { darkTheme } from '../../../theme/darkTheme'

type RequiredRole = 'ANONYMOUS' | 'USER' | 'EDITOR' | 'ADMIN'

interface Props {
    readonly requiredRole?: RequiredRole
}

const useStyles = createUseStyles({
    loadingWrapper: {
        backgroundColor: darkTheme.backgroundNearWhite,
        padding: '20px 0',
    },
})

const AccessDeniedPanel = () => {
    const { t } = useTranslation('common')
    const routes = useRoutes()
    const hp = routes.homepage()

    return (
        <FormPageRow>
            <p>{t('SignInRequired.accessDenied')}</p>
            <TextLink href={hp.href} as={hp.as}>
                <IconBack />
                &nbsp;
                {t('SignInRequired.backToHomepage')}
            </TextLink>
        </FormPageRow>
    )
}

const SignInRequiredWrapper: React.FC<Props> = ({ requiredRole = 'USER', children }) => {
    const loggedIn = useLoggedInUser()
    const { t } = useTranslation('common')
    const classes = useStyles()

    // Execute checks only when role is not ANONYMOUS (ANONYMOUS role exists so that requirements can be conditional based, for example, on page params)
    if (requiredRole !== 'ANONYMOUS') {
        if (!loggedIn && isInBrowser) {
            return <SignInPanel infoMessage={t('SignInRequired.signInRequired')} stayOnPage />
        }

        const role = loggedIn?.role
        if (!role) {
            // Loading
            return (
                <div className={classes.loadingWrapper}>
                    <BigLoading />
                </div>
            )
        }

        if (requiredRole === 'EDITOR' && role !== UserRole.Editor && role !== UserRole.Admin) {
            return <AccessDeniedPanel />
        }

        if (requiredRole === 'ADMIN' && role !== UserRole.Admin) {
            return <AccessDeniedPanel />
        }
    }

    return <>{children}</>
}

export default SignInRequiredWrapper
