import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useRouter } from 'next/router'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'

const useStyles = createUseStyles({
    wrapper: {
        margin: '4px 0 12px',
    },
    button: {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 16px',
        textAlign: 'center',
        borderRadius: 4,
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        color: darkTheme.textLight,
        textDecoration: 'none',
        fontSize: '0.95rem',
        '&:hover': {
            background: darkTheme.backgroundHover,
        },
    },
    error: {
        color: darkTheme.red,
        marginBottom: 16,
        fontSize: '0.9rem',
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
})

/** Reasons `/auth/google/callback` can send back as `?error=…`. */
const KNOWN_ERRORS = [
    'google_cancelled',
    'google_state',
    'google_failed',
    'google_unavailable',
    'google_unverified',
    'google_ambiguous',
    'google_conflict',
]

interface Props {
    readonly showDivider?: boolean
}

/**
 * "Pokračovat přes Google" — a plain link, not the Google JS widget: a link needs
 * no client id in the bundle, so adding or removing this feature is a server-side
 * environment change and never a front-end rebuild.
 *
 * The button only renders when the server says the OAuth client is configured
 * (`/auth/google/status`), so a deploy that lands before the credentials exist shows
 * nothing rather than a dead link.
 */
export const GoogleSignInButton = ({ showDivider }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const router = useRouter()
    const [enabled, setEnabled] = useState(false)

    useEffect(() => {
        let cancelled = false
        fetch('/auth/google/status')
            .then((response) => (response.ok ? response.json() : { enabled: false }))
            .then((data: { enabled?: boolean }) => {
                if (!cancelled) setEnabled(Boolean(data?.enabled))
            })
            .catch(() => {
                // Not configured, or the server is unreachable: offering the button
                // would only lead to an error page.
            })
        return () => {
            cancelled = true
        }
    }, [])

    const errorCode = typeof router.query.error === 'string' ? router.query.error : undefined
    const errorKey = errorCode && KNOWN_ERRORS.includes(errorCode) ? errorCode : undefined

    if (!enabled && !errorKey) return null

    // Where the user was when they clicked, so an in-place sign-in (rating,
    // comment) comes back to that page instead of the home page.
    const returnTo =
        typeof window === 'undefined' ? '/' : `${window.location.pathname}${window.location.search}`

    return (
        <div className={classes.wrapper}>
            {errorKey && <div className={classes.error}>{t(`SignIn.googleError.${errorKey}`)}</div>}
            {enabled && (
                <a className={classes.button} href={`/auth/google?returnTo=${encodeURIComponent(returnTo)}`}>
                    {t('SignIn.googleSignIn')}
                </a>
            )}
            {showDivider && enabled && <div className={classes.divider}>{t('SignIn.googleOrEmail')}</div>}
        </div>
    )
}

export default GoogleSignInButton
