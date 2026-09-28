import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../../theme/darkTheme'
import { GA_ENABLED, GA_CONSENT_KEY, storeGTagConsent, updateGTagConsent } from 'src/utils/gtag'

const useStyles = createUseStyles({
    wrapper: {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        background: darkTheme.backgroundLight,
        color: darkTheme.textDark,
        borderTop: '1px solid black',
        padding: '12px 16px',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    text: {
        maxWidth: 820,
        lineHeight: '150%',
    },
    button: {
        border: 0,
        borderRadius: 4,
        padding: '6px 16px',
        marginLeft: 8,
        cursor: 'pointer',
        background: darkTheme.textGreen,
        color: '#2F2F2F',
        fontWeight: 'bold',
        '&:hover': {
            opacity: 0.85,
        },
    },
    buttonSecondary: {
        border: `1px solid ${darkTheme.textDark}`,
        borderRadius: 4,
        padding: '6px 16px',
        marginLeft: 8,
        cursor: 'pointer',
        background: 'transparent',
        color: darkTheme.textDark,
        '&:hover': {
            color: darkTheme.textGreen,
            borderColor: darkTheme.textGreen,
        },
    },
})

/**
 * Google Consent Mode banner. Rendered only when analytics is actually wired, and only
 * until the visitor decides; the decision lives in localStorage and is replayed into
 * gtag on the next visit by the inline script in _document.
 */
export const CookieConsent = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [visible, setVisible] = React.useState(false)

    React.useEffect(() => {
        if (!GA_ENABLED) return
        let stored: string | null = null
        try {
            stored = window.localStorage.getItem(GA_CONSENT_KEY)
        } catch (err) {
            stored = null
        }
        if (stored === 'granted' || stored === 'denied') {
            updateGTagConsent(stored === 'granted')
            return
        }
        setVisible(true)
    }, [])

    const decide = (granted: boolean) => {
        storeGTagConsent(granted)
        updateGTagConsent(granted)
        setVisible(false)
    }

    if (!GA_ENABLED || !visible) return null

    return (
        <div className={classes.wrapper} data-testid="cookieConsent">
            <span className={classes.text}>{t('Cookies.text')}</span>
            <span>
                <button type="button" className={classes.button} onClick={() => decide(true)}>
                    {t('Cookies.accept')}
                </button>
                <button type="button" className={classes.buttonSecondary} onClick={() => decide(false)}>
                    {t('Cookies.reject')}
                </button>
            </span>
        </div>
    )
}
