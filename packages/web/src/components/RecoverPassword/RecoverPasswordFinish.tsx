import React, { useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { Form as FinalForm } from 'react-final-form'
import { useApolloClient } from '@apollo/client'
import { TFunction } from 'i18next'
import { useRoutes } from 'src/hooks/useRoutes'
import FormPageRow from '../common/FormPageRow/FormPageRow'
import { darkTheme } from '../../theme/darkTheme'
import FormTextInputField from '../common/form/FormTextInputField'
import { validateRequired, validateWithValidators } from '../../utils/validationUtils'
import {
    FinishRecoverPasswordMutation,
    FinishRecoverPasswordMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { useShowToast } from '../../hooks/useShowToast'
import { useFocusInput } from '../../hooks/useFocusInput'
import SubmitButton from '../common/SubmitButton/SubmitButton'

interface Props {
    readonly token: string
}

const finishRecoverPasswordGQL = require('./graphql/finishRecoverPasswordMutation.graphql')

const useStyles = createUseStyles({
    error: {
        color: darkTheme.red,
        marginBottom: 16,
    },
})

type TState = 'initial' | 'loading' | 'error'

interface FormData {
    readonly password: string
    readonly passwordConfirmation: string
}

const validate = (t: TFunction) => (data: FormData) => {
    const res = validateWithValidators(
        data,
        {
            password: validateRequired,
        },
        t,
    )

    if (data.passwordConfirmation !== data.password) {
        res.passwordConfirmation = t('RecoverPassword.passwordConfirmationError')
    }

    return res
}

const RecoverPasswordFinish = ({ token }: Props) => {
    const { t } = useTranslation('common')
    const [state, setState] = useState<TState>('initial')
    const classes = useStyles()
    const client = useApolloClient()
    const routes = useRoutes()
    const showToast = useShowToast()
    const formRef = useFocusInput<HTMLFormElement>('password')

    const onSubmit = ({ password }: FormData) => {
        setState('loading')

        client
            .mutate<FinishRecoverPasswordMutation, FinishRecoverPasswordMutationVariables>({
                mutation: finishRecoverPasswordGQL,
                variables: {
                    newPassword: password,
                    token,
                },
            })
            .catch(() => {
                setState('error')
            })
            .then(() => {
                // Success
                showToast('RecoverPassword.changed', 'success')
                client.resetStore().then(() => routes.push(routes.homepage()))
            })
    }

    return (
        <FormPageRow headerText={t('RecoverPassword.header')}>
            {state === 'error' && <div className={classes.error}>{t('RecoverPassword.changeError')}</div>}
            <FinalForm<FormData>
                onSubmit={onSubmit}
                validate={validate(t)}
                render={({ handleSubmit }) => (
                    <form onSubmit={handleSubmit} ref={formRef}>
                        <FormTextInputField
                            name="password"
                            type="password"
                            placeholder={t('RecoverPassword.password')}
                        />
                        <FormTextInputField
                            name="passwordConfirmation"
                            type="password"
                            autoComplete="new-password"
                            placeholder={t('RecoverPassword.passwordConfirmation')}
                        />

                        <SubmitButton submitting={state === 'loading'}>{t('RecoverPassword.submit')}</SubmitButton>
                    </form>
                )}
            />
        </FormPageRow>
    )
}

export default RecoverPasswordFinish
