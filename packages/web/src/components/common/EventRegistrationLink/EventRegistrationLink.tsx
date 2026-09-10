import React from 'react'
import classNames from 'classnames'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../../theme/darkTheme'
import { isAbsoluteHttpUrl } from '../../../utils/urlUtils'

interface Props {
    readonly url?: string | null
    readonly open: boolean
    readonly className?: string
    readonly onDarkBackground?: boolean
}

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
        display: 'inline-block',
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
})

const EventRegistrationLink = ({ url, open, className, onDarkBackground = false }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    if (!isAbsoluteHttpUrl(url)) {
        return null
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
