import React from 'react'
import { createUseStyles } from 'react-jss'
import Link from 'next/link'
import { darkTheme } from '../../../theme/darkTheme'
import { Route } from '../../../hooks/useRoutes'
import { useHideInPlaceLogin } from '../../../hooks/useHideInPlaceLogin'
import { breakPoints } from '../../../theme/breakPoints'

interface Props {
    readonly route: string | Route
    readonly target?: string
}

export const headerLinkStyle = {
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 0,
    color: darkTheme.text,
    fontSize: '0.8rem',
    border: 0,
    background: 'transparent',
    width: '100%',

    '&:hover': {
        color: darkTheme.textGreen,
    },
}

export const headerLinkStyleMd = {
    padding: '0 15px',
    width: 'auto',
}

const useStyles = createUseStyles({
    link: headerLinkStyle,
    [`@media(min-width: ${breakPoints.md}px)`]: {
        link: headerLinkStyleMd,
    },
})

export const HeaderNavLink: React.FC<Props> = ({ route, target, children }) => {
    const classes = useStyles()

    // When link is clicked, we need to hide in-place login, so user sees page content
    const hideInPlaceLogin = useHideInPlaceLogin()

    if (typeof route === 'string') {
        // External link
        return (
            <a className={classes.link} href={route} target={target}>
                {children}
            </a>
        )
    }

    return (
        <Link href={route.as} legacyBehavior passHref>
            <a href="/" className={classes.link} onClick={hideInPlaceLogin}>
                {children}
            </a>
        </Link>
    )
}
