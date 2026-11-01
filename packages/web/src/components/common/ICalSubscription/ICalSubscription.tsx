import React, { useEffect, useState } from 'react'
import classNames from 'classnames'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../../theme/darkTheme'
import { useShowToast } from '../../../hooks/useShowToast'
import { componentTestIds } from '../../componentTestIds'

interface Props {
    /** Extra query the subscription URL carries, e.g. `?id=<userId>` for a personal feed. */
    readonly query?: string
    /** Renders the block for a dark page background (event detail header). */
    readonly onDarkBackground?: boolean
}

const useStyles = createUseStyles({
    wrapper: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    link: {
        fontSize: '0.78rem',
        fontWeight: 700,
        color: darkTheme.textOnLightDark,

        '&:hover, &:focus': {
            color: darkTheme.textGreenDark,
        },
    },
    darkBackgroundLink: {
        color: darkTheme.textGreen,

        '&:hover, &:focus': {
            color: darkTheme.text,
        },
    },
    url: {
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
        wordBreak: 'break-all',
    },
    darkBackgroundUrl: {
        color: darkTheme.textLighter,
    },
    copyButton: {
        padding: '4px 10px',
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 4,
        backgroundColor: 'transparent',
        color: darkTheme.textOnLight,
        fontSize: '0.72rem',
        cursor: 'pointer',

        '&:hover, &:focus': {
            backgroundColor: darkTheme.backgroundAlmostNearWhite,
        },
    },
    darkBackgroundCopy: {
        borderColor: darkTheme.textLighter,
        color: darkTheme.text,

        '&:hover, &:focus': {
            backgroundColor: darkTheme.backgroundNearWhite,
            color: darkTheme.textOnLightDark,
        },
    },
})

/**
 * The /ical subscription affordance: a native link to the feed plus the full
 * URL and a copy-to-clipboard button, so the address is visible and copyable
 * even where a plain link is not discoverable. The URL is built in an effect
 * (window is unavailable during SSR).
 */
const ICalSubscription = ({ query = '', onDarkBackground = false }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const showToast = useShowToast()
    const [url, setUrl] = useState('')

    useEffect(() => {
        setUrl(`${window.location.protocol}//${window.location.host}/ical${query}`)
    }, [query])

    const handleCopy = async () => {
        if (!url) {
            return
        }
        try {
            await navigator.clipboard.writeText(url)
            showToast(t('ICal.copied'), 'success')
        } catch {
            // Clipboard API unavailable (non-secure context, permissions): the
            // URL stays visible next to the button, so nothing is lost.
        }
    }

    return (
        <div
            className={classes.wrapper}
            data-testid={componentTestIds.icalSubscription.wrapper}
            data-url={url || undefined}
        >
            <a
                href={`/ical${query}`}
                target="_blank"
                rel="noreferrer"
                className={classNames(classes.link, { [classes.darkBackgroundLink]: onDarkBackground })}
                data-testid={componentTestIds.icalSubscription.link}
            >
                {t('ICal.subscribe')}
            </a>
            {url && (
                <>
                    <span className={classNames(classes.url, { [classes.darkBackgroundUrl]: onDarkBackground })}>{url}</span>
                    <button
                        type="button"
                        className={classNames(classes.copyButton, { [classes.darkBackgroundCopy]: onDarkBackground })}
                        onClick={handleCopy}
                        data-testid={componentTestIds.icalSubscription.copy}
                    >
                        {t('ICal.copy')}
                    </button>
                </>
            )}
        </div>
    )
}

export default ICalSubscription
