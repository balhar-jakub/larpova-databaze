import React, { useState } from 'react'
import { useApolloClient, useQuery } from '@apollo/client'
import { Form as FinalForm } from 'react-final-form'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { useRoutes } from 'src/hooks/useRoutes'
import isInBrowser from 'is-in-browser'
import FormPageRow from '../common/FormPageRow/FormPageRow'
import FormTextInputField from '../common/form/FormTextInputField'
import { fieldValidator, validateRequired } from '../../utils/validationUtils'
import {
    ChangePasswordMutation,
    ChangePasswordMutationVariables,
    LoadCurrentUserSettingsQuery,
} from '../../graphql/__generated__/typescript-operations'
import UserDetailPanel from './UserDetailPanel'
import UserProfileTabs from './UserProfileTabs'
import { useShowToast } from '../../hooks/useShowToast'
import GraphQLErrorContent, { PropsFromGraphQLError } from '../common/GraphQLErrorContent/GraphQLErrorContent'
import SubmitButton from '../common/SubmitButton/SubmitButton'

const loadUserSettingsGql = require('./graphql/loadCurrentUserSettings.graphql')
const changePasswordGql = require('./graphql/changePassword.graphql')

interface FormData {
    oldPassword: string
    newPassword: string
    newPasswordAgain: string
}

type TState = 'idle' | 'loading' | 'oldPasswordError'

const validate = (t: TFunction, hasOldPasswordError: boolean) => (data: FormData) => {
    return {
        oldPassword: hasOldPasswordError ? t('ChangePassword.oldPasswordError') : undefined,
        newPasswordAgain:
            data.newPassword !== data.newPasswordAgain ? t('ChangePassword.passwordAgainError') : undefined,
    }
}

const ChangePasswordPanel = () => {
    const loadQuery = useQuery<LoadCurrentUserSettingsQuery>(loadUserSettingsGql, {
        skip: !isInBrowser,
        fetchPolicy: 'cache-and-network',
    })
    const client = useApolloClient()
    const { t } = useTranslation('common')
    const routes = useRoutes()
    const [state, setState] = useState<TState>('idle')
    const loggedInUser = loadQuery.data?.loggedInUser
    const showToast = useShowToast()

    const onSubmit = async (data: FormData) => {
        setState('loading')
        const variables: ChangePasswordMutationVariables = {
            oldPassword: data.oldPassword,
            newPassword: data.newPassword,
        }

        client
            .mutate<ChangePasswordMutation, ChangePasswordMutationVariables>({
                mutation: changePasswordGql,
                variables,
            })
            .then(() => {
                // Success - show message and go to profile
                showToast(t('ChangePassword.changed'), 'success')
                routes.push(routes.currentProfile())
            })
            .catch(e => {
                const firstError = e?.graphQLErrors?.[0]
                if (firstError?.extensions?.path === 'oldPassword') {
                    setState('oldPasswordError')
                } else {
                    if (firstError) {
                        const { errorClass, valuePath } = PropsFromGraphQLError(firstError)
                        showToast(<GraphQLErrorContent errorClass={errorClass} valuePath={valuePath} />, 'alert')
                    }
                    setState('idle')
                }
            })
    }

    return (
        <>
            <UserDetailPanel userData={loggedInUser ?? undefined} />
            <UserProfileTabs selectedTab="changePassword" />
            <FormPageRow headerText={t('ChangePassword.header')}>
                <FinalForm<FormData>
                    onSubmit={onSubmit}
                    validate={validate(t, state === 'oldPasswordError')}
                    render={({ handleSubmit }) => (
                        <form onSubmit={handleSubmit}>
                            <input
                                type="hidden"
                                name="username"
                                autoComplete="username"
                                value={loggedInUser?.email || '_'}
                            />
                            <FormTextInputField
                                name="oldPassword"
                                type="password"
                                autoComplete="current-password"
                                placeholder={t('ChangePassword.oldPassword')}
                                validate={fieldValidator(t, validateRequired)}
                                onChange={() => setState('idle')}
                            />
                            <FormTextInputField
                                name="newPassword"
                                type="password"
                                autoComplete="new-password"
                                placeholder={t('ChangePassword.newPassword')}
                                validate={fieldValidator(t, validateRequired)}
                            />
                            <FormTextInputField
                                name="newPasswordAgain"
                                type="password"
                                autoComplete="new-password"
                                placeholder={t('ChangePassword.newPasswordAgain')}
                                validate={fieldValidator(t, validateRequired)}
                            />
                            <SubmitButton submitting={state === 'loading'}>{t('ChangePassword.submit')}</SubmitButton>
                        </form>
                    )}
                />
            </FormPageRow>
        </>
    )
}

export default ChangePasswordPanel
