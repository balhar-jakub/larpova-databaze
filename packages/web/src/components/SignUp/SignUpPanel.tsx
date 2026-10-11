import React, { useState } from 'react'
import { useApolloClient, useMutation } from '@apollo/client'
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
    StartEmailLoginMutation,
    StartEmailLoginMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { TextLink } from '../common/TextLink/TextLink'
import ReCaptchaField from './ReCaptchaField'
import { useIsEmailAvailable } from '../../hooks/useIsEmailAvailable'
import { useFocusInput } from '../../hooks/useFocusInput'
import SubmitButton from '../common/SubmitButton/SubmitButton'
import { useIsMdOrLarger } from '../../hooks/useMediaQuery'

const createUserGql = require(`./graphql/createUserMutation.graphql`)
const startEmailLoginGql = require(`../SignIn/graphql/startEmailLogin.graphql`)

interface FormData {
    email: string
    password: string
    passwordAgain: string
    recaptcha: string
}

type TState = 'idle' | 'loading'

type TMode = 'link' | 'password'

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

/**
 * One form, two paths. The default mode (`link`) asks for the email only and
 * sends a magic link — the account is created by startEmailLogin's
 * auto-registration when the link is used. The `password` mode expands in
 * place into the optional alternative (password + reCAPTCHA) via the
 * "Chci si rovnou nastavit heslo" toggle; the email already typed is kept.
 * Everything else (name, city, …) waits until the user is signed in.
 */
const SignUpPanel = () => {
    const { t } = useTranslation('common')
    const client = useApolloClient()
    const routes = useRoutes()
    const formRef = useFocusInput<HTMLFormElement>('email')
    const [state, setState] = useState<TState>('idle')
    const [mode, setMode] = useState<TMode>('link')
    const [linkSentTo, setLinkSentTo] = useState<string | undefined>(undefined)
    const { usedByUser, isEmailAvailable } = useIsEmailAvailable()
    const isMdOrLarger = useIsMdOrLarger()
    const { href: recoverHref, as: recoverAs } = routes.recoverPasswordStart()

    const [startEmailLogin] = useMutation<StartEmailLoginMutation, StartEmailLoginMutationVariables>(
        startEmailLoginGql,
    )

    const sendMagicLink = async (data: FormData) => {
        setState('loading')
        try {
            await startEmailLogin({
                variables: {
                    email: data.email.trim(),
                    loginUrlTemplate: `${window.location.origin}/auth/email-login?token={token}`,
                },
            })
            setLinkSentTo(data.email.trim())
        } finally {
            setState('idle')
        }
    }

    const createWithPassword = async (data: FormData) => {
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

    if (linkSentTo) {
        return (
            <FormPageRow headerText={t('SignUp.header')}>
                <Form.Text>{t('SignIn.magicLinkSent', { email: linkSentTo })}</Form.Text>
                <br />
                <button
                    type="button"
                    className="btn btn-link p-0"
                    onClick={() => {
                        setLinkSentTo(undefined)
                        setMode('password')
                    }}
                >
                    {t('SignUp.linkNotArrivedUsePassword')}
                </button>
            </FormPageRow>
        )
    }

    return (
        <FormPageRow headerText={t('SignUp.header')}>
            <FinalForm<FormData>
                onSubmit={(data) => (mode === 'link' ? sendMagicLink(data) : createWithPassword(data))}
                validate={validate(t)}
                render={({ handleSubmit, values }) => {
                    // In the link mode an existing account is not an error — the
                    // magic link simply logs its owner in. The availability check
                    // (and its hint) only matters when creating a duplicate would
                    // actually fail, i.e. the password mode.
                    const handleEmailOnBlur = () => {
                        if (mode === 'password') {
                            isEmailAvailable(values.email)
                        }
                    }

                    return (
                        <form onSubmit={handleSubmit} ref={formRef}>
                            <Form.Text>{mode === 'link' ? t('SignUp.linkIntro') : t('SignUp.passwordIntro')}</Form.Text>
                            <FormTextInputField
                                name="email"
                                placeholder={t('UserFields.email')}
                                validate={fieldValidator(t, [validateRequired, validateEmail])}
                                onBlur={handleEmailOnBlur}
                                errorHint={
                                    mode === 'password' && usedByUser ? (
                                        <EmailUsedErrorHint name={usedByUser.name} href={recoverHref} as={recoverAs} />
                                    ) : undefined
                                }
                            />
                            {mode === 'password' && (
                                <>
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
                                </>
                            )}
                            <SubmitButton submitting={state === 'loading'} disabled={mode === 'password' && !!usedByUser}>
                                {mode === 'link' ? t('SignUp.sendMagicLink') : t('SignUp.submit')}
                            </SubmitButton>
                            <br />
                            <button type="button" className="btn btn-link p-0" onClick={() => setMode(mode === 'link' ? 'password' : 'link')}>
                                {mode === 'link' ? t('SignUp.setPasswordToggle') : t('SignUp.backToLinkToggle')}
                            </button>
                        </form>
                    )
                }}
            />
        </FormPageRow>
    )
}

export default SignUpPanel
