import React from 'react'
import classNames from 'classnames'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../../theme/darkTheme'
import { isAbsoluteHttpUrl } from '../../../utils/urlUtils'

interface Props {
    readonly url?: string | null
    readonly open: boolean
    readonly status?: string | null
    readonly opensAt?: string | null
    readonly className?: string
    readonly onDarkBackground?: boolean
}

const INLINE_BLOCK = 'inline-block'

const useStyles = createUseStyles({
    link: {
        color: darkTheme.textOnLightDark,

        '&:hover, &:focus': {
            color: darkTheme.textOnLight,
        },
    },
    darkBackground: {
        color: darkTheme.textGreen,

        '&:hover, &:focus': {
            color: darkTheme.text,
        },
    },
    open: {
        display: INLINE_BLOCK,
        padding: '6px 10px',
        borderRadius: 4,
        backgroundColor: darkTheme.textGreen,
        color: darkTheme.textOnLightDark,
        fontWeight: 700,
        textDecoration: 'none',

        '&:hover, &:focus': {
            backgroundColor: darkTheme.backgroundNearWhite,
            color: darkTheme.textOnLightDark,
            textDecoration: 'none',
        },
    },
    closedBadge: {
        display: INLINE_BLOCK,
        padding: '6px 10px',
        borderRadius: 4,
        backgroundColor: darkTheme.red,
        color: darkTheme.backgroundRealWhite,
        fontWeight: 700,
    },
    upcomingBadge: {
        display: INLINE_BLOCK,
        padding: '6px 10px',
        borderRadius: 4,
        border: `1px solid ${darkTheme.text}`,
        color: darkTheme.text,
        fontWeight: 700,
    },
    closedFormLink: {
        marginTop: 2,
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
        textDecoration: 'underline',

        '&:hover, &:focus': {
            color: darkTheme.textOnLightDark,
        },
    },
})

const formatOpensAt = (opensAt?: string | null): string | null => {
    if (!opensAt) {
        return null
    }

    const date = new Date(opensAt)
    if (isNaN(date.getTime())) {
        return null
    }

    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

const EventRegistrationLink = ({ url, open, status, opensAt, className, onDarkBackground = false }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    if (!isAbsoluteHttpUrl(url)) {
        return null
    }

    if (status === 'UPCOMING') {
        // Registration was announced but has not opened yet; the organizer
        // flips it manually (possibly with the URL added later).
        const openDate = formatOpensAt(opensAt)
        return (
            <span className={className}>
                <span className={classes.upcomingBadge}>
                    {openDate ? t('Event.registrationOpensOn', { date: openDate }) : t('Event.registrationUpcoming')}
                </span>
                <a href={url} target="_blank" rel="noreferrer" className={classes.closedFormLink}>
                    {t('Event.registrationOrganizerForm')}
                </a>
            </span>
        )
    }

    if (!open) {
        // Registration exists but is closed (waiting list / reserves): the badge
        // states it plainly, the organizer's form stays one click away.
        return (
            <span className={className}>
                <span className={classes.closedBadge}>{t('Event.registrationClosed')}</span>
                <a href={url} target="_blank" rel="noreferrer" className={classes.closedFormLink}>
                    {t('Event.registrationOrganizerForm')}
                </a>
            </span>
        )
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={classNames(classes.link, className, {
                [classes.darkBackground]: onDarkBackground,
                [classes.open]: open,
            })}
        >
            {t(open ? 'Event.registrationOpen' : 'Event.registrationLink')}
        </a>
    )
}

export default EventRegistrationLink
