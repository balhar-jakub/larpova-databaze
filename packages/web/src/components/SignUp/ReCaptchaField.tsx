import React from 'react'
import { useQuery } from '@apollo/client'
import { Field } from 'react-final-form'
import ReCAPTCHA, { ReCAPTCHAProps } from 'react-google-recaptcha'
import { useTranslation } from 'react-i18next'
import { createUseStyles } from 'react-jss'
import isInBrowser from 'is-in-browser'
import { GetConfigQuery, GetConfigQueryVariables } from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'

// https://www.ipify.org/

const getConfigGql = require(`./graphql/getConfigQuery.graphql`)

interface Props {
    readonly name: string
    readonly size?: ReCAPTCHAProps['size']
}

const useStyles = createUseStyles({
    error: {
        fontSize: '0.85rem',
        color: darkTheme.red,
    },
    wrapper: {
        minHeight: 80,
        marginBottom: '1rem',
    },
})

const ReCaptchaField = ({ name, size }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()

    const configResult = useQuery<GetConfigQuery, GetConfigQueryVariables>(getConfigGql, {
        skip: !isInBrowser,
        fetchPolicy: 'cache-first',
    })
    const reCaptchaKey = configResult.data?.config?.reCaptchaKey

    const validate = (input?: string) => {
        return input ? undefined : t('ReCaptchaField.required')
    }

    return (
        <Field<string> name={name} validate={validate}>
            {({ input, meta }) => {
                const error = meta.submitFailed && meta.error

                const handleChange = (token: string | null) => input.onChange({ target: { value: token } })

                return (
                    <div className={classes.wrapper}>
                        {reCaptchaKey && <ReCAPTCHA sitekey={reCaptchaKey} size={size} onChange={handleChange} />}
                        {error && <div className={classes.error}>{error}</div>}
                    </div>
                )
            }}
        </Field>
    )
}

export default ReCaptchaField
