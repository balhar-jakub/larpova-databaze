import React from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import Link from 'next/link'
import { UrlObject } from 'url'
import { darkTheme } from '../../../theme/darkTheme'

interface Props {
    readonly href: string | UrlObject
    readonly as: string
    readonly className?: string
    readonly onClick?: () => void
}

const useStyles = createUseStyles({
    link: {
        color: darkTheme.textGreenDark,
        fontSize: '0.85rem',

        '&:hover': {
            color: darkTheme.textGreen,
        },
    },
})

export const TextLink: React.FC<Props> = ({ href, as, className, onClick, children }) => {
    const classes = useStyles()

    return (
        <Link href={as || href} legacyBehavior>
            <a href="/" className={classNames(classes.link, className)} onClick={onClick}>
                {children}
            </a>
        </Link>
    )
}
