import React, { useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import { useMutation } from '@apollo/client';
import { useTranslation } from '../../lib/i18n';
import { createUseStyles } from 'react-jss';
import { darkTheme } from '../../theme/darkTheme';
import { fieldValidator, validateEmail, validateRequired } from '../../utils/validationUtils';
import FormTextInputField from '../common/form/FormTextInputField';
import SubmitButton from '../common/SubmitButton/SubmitButton';
import {
    StartEmailLoginMutation,
    StartEmailLoginMutationVariables,
} from '../../graphql/__generated__/typescript-operations';

const startEmailLoginGql = require('./graphql/startEmailLogin.graphql');

const useStyles = createUseStyles({
    wrapper: {
        margin: '12px 0',
    },
    feedback: {
        textAlign: 'center',
        fontSize: '0.85rem',
        marginTop: 8,
        color: darkTheme.textGreen,
    },
    error: {
        color: '#e74c3c',
    },
    divider: {
        display: 'flex',
        alignItems: 'center',
        margin: '16px 0',
        color: darkTheme.textLighter,
        fontSize: '0.8rem',
        '&::before': {
            content: '""',
            flex: 1,
            borderBottom: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
            marginRight: 12,
        },
        '&::after': {
            content: '""',
            flex: 1,
            borderBottom: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
            marginLeft: 12,
        },
    },
});

interface FormData {
    email: string;
}

interface EmailLoginFormProps {
    showDivider?: boolean;
}

/**
 * The email-only "magic link" login form. Uses the shared FormTextInputField +
 * SubmitButton so the sign-in and sign-up pages speak one visual language.
 */
export const EmailLoginForm = ({ showDivider }: EmailLoginFormProps) => {
    const classes = useStyles();
    const { t } = useTranslation('common');
    const [sentTo, setSentTo] = useState<string | undefined>(undefined);

    const [startLogin, { loading, error }] = useMutation<
        StartEmailLoginMutation,
        StartEmailLoginMutationVariables
    >(startEmailLoginGql);

    const handleSubmit = async (data: FormData) => {
        const email = data.email.trim();
        const loginUrlTemplate = `${window.location.origin}/auth/email-login?token={token}`;

        await startLogin({
            variables: { email, loginUrlTemplate },
        });

        setSentTo(email);
    };

    if (sentTo) {
        return (
            <div className={classes.wrapper}>
                <div className={classes.feedback}>
                    {t('SignIn.magicLinkSent', { email: sentTo })}
                </div>
            </div>
        );
    }

    return (
        <div className={classes.wrapper}>
            <FinalForm<FormData>
                onSubmit={handleSubmit}
                render={({ handleSubmit: formSubmit }) => (
                    <form onSubmit={formSubmit}>
                        <FormTextInputField
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder={t('SignIn.emailPlaceholder')}
                            validate={fieldValidator(t, [validateRequired, validateEmail])}
                        />
                        {error && (
                            <div className={`${classes.feedback} ${classes.error}`}>
                                {t('SignIn.magicLinkError')}
                            </div>
                        )}
                        <SubmitButton submitting={loading}>{t('SignIn.sendMagicLink')}</SubmitButton>
                    </form>
                )}
            />
            {showDivider && <div className={classes.divider}>{t('SignIn.orUsePassword')}</div>}
        </div>
    );
};
