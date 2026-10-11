import React, { useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { Form as FinalForm } from 'react-final-form'
import { TFunction } from 'i18next'
import { Row, Col, Form } from 'react-bootstrap'
import { useTranslation } from 'src/lib/i18n'
import { useRoutes } from 'src/hooks/useRoutes'
import { UrlObject } from 'url'
import FormPageRow from '../common/FormPageRow/FormPageRow'
import FormTextInputField from '../common/form/FormTextInputField'
import { fieldValidator, validateEmail, validateRequired } from '../../utils/validationUtils'
import {
    CreateUserMutation,
    CreateUserMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { TextLink } from '../common/TextLink/TextLink'
import ReCaptchaField from './ReCaptchaField'
import { useIsEmailAvailable } from '../../hooks/useIsEmailAvailable'
import { useFocusInput } from '../../hooks/useFocusInput'
import SubmitButton from '../common/SubmitButton/SubmitButton'
import { useIsMdOrLarger } from '../../hooks/useMediaQuery'

const createUserGql = require(`./graphql/createUserMutation.graphql`)

interface FormData {
    email: string
    password: string
    passwordAgain: string
    recaptcha: string
}

type TState = 'idle' | 'loading'

const validate = (t: TFunction) => (data: FormData) => {
    return {
        passwordAgain: data.password !== data.passwordAgain ? t('SignUp.passwordAgainError') : undefined,
    }
}

const EmailUsedErrorHint = ({ name, href, as }: { name: string; href: UrlObject; as: string }) => {
    const { t } = useTranslation('common')
    return (
        <Form.Text>
            {t('SignUp.emailAlreadyUsed', { name })}{' '}
            <TextLink href={href} as={as}>
                {t('SignUp.forgotPassword')}
            </TextLink>
            .
        </Form.Text>
    )
}

const SignUpPanel = () => {
    const { t } = useTranslation('common')
    const client = useApolloClient()
    const routes = useRoutes()
    const formRef = useFocusInput<HTMLFormElement>('email')
    const [state, setState] = useState<TState>('idle')
    const { usedByUser, isEmailAvailable } = useIsEmailAvailable()
    const isMdOrLarger = useIsMdOrLarger()
    const { href: recoverHref, as: recoverAs } = routes.recoverPasswordStart()

    const onSubmit = async (data: FormData) => {
        setState('loading')

        const emailAvailable = await isEmailAvailable(data.email)
        if (!emailAvailable) {
            // Just return some error - display is done based on usedByName anyway
            setState('idle')
            return { emailAvailable: 'unavailable' }
        }

        const variables: CreateUserMutationVariables = {
            input: {
                email: data.email,
                password: data.password,
                recaptcha: data.recaptcha,
            },
        }

        const res = await client.mutate<CreateUserMutation, CreateUserMutationVariables>({
            mutation: createUserGql,
            variables,
        })

        if (res.data?.user?.createUser?.id) {
            // Success - go to homepage
            await client.resetStore()
            routes.push(routes.homepage())
            return undefined
        }

        setState('idle')
        return undefined
    }

    return (
        <FormPageRow headerText={t('SignUp.header')}>
            <FinalForm<FormData>
                onSubmit={onSubmit}
                validate={validate(t)}
                render={({ handleSubmit, values }) => {
                    const handleEmailOnBlur = () => {
                        isEmailAvailable(values.email)
                    }

                    return (
                        <form onSubmit={handleSubmit} ref={formRef}>
                            <FormTextInputField
                                name="email"
                                placeholder={t('UserFields.email')}
                                validate={fieldValidator(t, [validateRequired, validateEmail])}
                                onBlur={handleEmailOnBlur}
                                errorHint={
                                    usedByUser ? (
                                        <EmailUsedErrorHint name={usedByUser.name} href={recoverHref} as={recoverAs} />
                                    ) : undefined
                                }
                            />
                            <Row>
                                <Col md={6}>
                                    <FormTextInputField
                                        name="password"
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder={t('UserFields.password')}
                                        validate={fieldValidator(t, validateRequired)}
                                    />
                                </Col>
                                <Col md={6}>
                                    <FormTextInputField
                                        name="passwordAgain"
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder={t('UserFields.passwordAgain')}
                                        validate={fieldValidator(t, validateRequired)}
                                    />
                                </Col>
                            </Row>
                            {/* ReCaptcha cannot change width when active, so we have to recreate it when size changes */}
                            {isMdOrLarger === true && <ReCaptchaField name="recaptcha" />}
                            {isMdOrLarger === false && <ReCaptchaField name="recaptcha" size="compact" />}
                            <SubmitButton submitting={state === 'loading'} disabled={!!usedByUser}>
                                {t('SignUp.submit')}
                            </SubmitButton>
                        </form>
                    )
                }}
            />
        </FormPageRow>
    )
}

export default SignUpPanel
