import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { createUseStyles } from 'react-jss';
import { useTranslation } from '../../lib/i18n';
import { darkTheme } from '../../theme/darkTheme';
import {
    StartEmailLoginMutation,
    StartEmailLoginMutationVariables,
} from '../../graphql/__generated__/typescript-operations';

const startEmailLoginGql = require('./graphql/startEmailLogin.graphql');

const useStyles = createUseStyles({
    wrapper: {
        margin: '12px 0',
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        border: `1px solid ${darkTheme.borderLight}`,
        borderRadius: 4,
        backgroundColor: darkTheme.backgroundControl,
        color: darkTheme.text,
        fontSize: '0.9rem',
        marginBottom: 8,
        '&::placeholder': {
            color: darkTheme.textLighter,
        },
    },
    button: {
        width: '100%',
        padding: '10px 16px',
        border: 'none',
        borderRadius: 4,
        backgroundColor: darkTheme.textGreen,
        color: darkTheme.backgroundWhite,
        fontSize: '0.9rem',
        cursor: 'pointer',
        '&:hover': {
            opacity: 0.9,
        },
        '&:disabled': {
            opacity: 0.5,
            cursor: 'not-allowed',
        },
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
            borderBottom: `1px solid ${darkTheme.borderLight}`,
            marginRight: 12,
        },
        '&::after': {
            content: '""',
            flex: 1,
            borderBottom: `1px solid ${darkTheme.borderLight}`,
            marginLeft: 12,
        },
    },
});

interface EmailLoginFormProps {
    showDivider?: boolean;
}

export const EmailLoginForm = ({ showDivider }: EmailLoginFormProps) => {
    const classes = useStyles();
    const { t } = useTranslation('common');
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);

    const [startLogin, { loading, error }] = useMutation<
        StartEmailLoginMutation,
        StartEmailLoginMutationVariables
    >(startEmailLoginGql);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.includes('@')) return;

        const loginUrlTemplate = `${window.location.origin}/auth/email-login?token={token}`;

        await startLogin({
            variables: { email: email.trim(), loginUrlTemplate },
        });

        setSent(true);
    };

    if (sent) {
        return (
            <div className={classes.wrapper}>
                <div className={classes.feedback}>
                    {t('SignIn.magicLinkSent', { email })}
                </div>
            </div>
        );
    }

    return (
        <div className={classes.wrapper}>
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    className={classes.input}
                    placeholder={t('SignIn.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                {error && (
                    <div className={`${classes.feedback} ${classes.error}`}>
                        {t('SignIn.magicLinkError')}
                    </div>
                )}
                <button type="submit" className={classes.button} disabled={loading}>
                    {loading ? t('SignIn.sending') : t('SignIn.sendMagicLink')}
                </button>
            </form>
            {showDivider && <div className={classes.divider}>{t('SignIn.orUsePassword')}</div>}
        </div>
    );
};
