import React, { useEffect, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import classNames from 'classnames'
import { Button } from 'react-bootstrap'
import { Router } from 'next/router'
import { HeaderNavLink } from './HeaderNavLink'
import { darkTheme } from '../../../theme/darkTheme'
import { WidthFixer } from '../WidthFixer/WidthFixer'
import { HeaderSearchForm } from './HeaderSearchForm'
import HeaderUser from './HeaderUser'
import { useRoutes } from '../../../hooks/useRoutes'
import { useHideInPlaceLogin } from '../../../hooks/useHideInPlaceLogin'
import { breakPoints } from '../../../theme/breakPoints'
import { IconMenu } from '../Icons/Icons'

const useStyles = createUseStyles({
    placeholder: {
        height: 55,
        [`@media(min-width: ${breakPoints.md}px)`]: {
            height: 105,
        },
        [`@media(min-width: ${breakPoints.lg}px)`]: {
            height: 55,
        },
    },
    image: {
        height: 55,
    },
    container: {
        backgroundColor: darkTheme.backgroundLight,
        borderBottom: '1px solid black',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    innerContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    rightSpacer: {
        marginRight: 15,
    },
    part: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    linksPart: {
        order: 8,
        flexBasis: '100%',
        flexDirection: 'column',
        alignItems: 'flex-start',
        borderTop: `1px solid ${darkTheme.textOnLight}`,
        marginBottom: 8,
    },
    userPart: {
        order: 7,
        margin: '0 0 5px',
        flexBasis: '100%',
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    buttonLike: {
        backgroundColor: darkTheme.redLight,
        borderRadius: 4,
        padding: 8,
        fontSize: '0.8em',
        fontWeight: 700,
        width: '100%',
        color: darkTheme.textLight,

        '&:hover': {
            backgroundColor: darkTheme.red,
        },
    },
    buttonFull: {},
    buttonShort: {
        display: 'none',
    },
    expandButton: {
        display: 'block',
        order: 4,
        height: 40,
        margin: '7px 0',
    },
    [`@media(min-width: ${breakPoints.md}px)`]: {
        linksPart: {
            flexGrow: 1,
            flexDirection: 'row',
            alignItems: 'center',
            flexBasis: 'auto',
            justifyContent: 'center',
            borderTop: 0,
            marginBottom: 10,
        },
        userPart: {
            margin: 0,
            order: 3,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexBasis: 'auto',
            flexGrow: 1,
        },
        expandButton: {
            display: 'none !important',
        },
        buttonLike: {
            width: 'auto',
        },
    },
    [`@media(min-width: ${breakPoints.lg}px)`]: {
        buttonFull: {
            display: 'none',
        },
        buttonShort: {
            display: 'inline-block',
        },
        linksPart: {
            order: 2,
            justifyContent: 'flex-start',
            marginBottom: 0,
        },
        innerContainer: {
            height: 55,
            flexWrap: 'nowrap',
        },
        userPart: {
            flexGrow: 0,
        },
    },
    [`@media(min-width: ${breakPoints.xl}px)`]: {
        buttonFull: {
            display: 'inline-block',
        },
        buttonShort: {
            display: 'none',
        },
    },
})

export const PageHeader = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const routes = useRoutes()
    const [showMenu, setShowMenu] = useState(false)

    // Hide menu on page change
    useEffect(() => {
        const hideMenu = () => setShowMenu(false)

        Router.events.on('routeChangeComplete', hideMenu)

        return () => {
            Router.events.off('routeChangeComplete', hideMenu)
        }
    }, [setShowMenu])

    // Set document title
    useEffect(() => {
        document.title = t('PageHeader.csld')
    }, [t])

    // When link is clicked, we need to hide in-place login, so user sees page content
    const hideInPlaceLogin = useHideInPlaceLogin()

    const handleToggleMenu = () => setShowMenu(old => !old)

    return (
        <>
            <nav className={classes.container} id="mainNav">
                <WidthFixer className={classes.innerContainer}>
                    <Link href="/" legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a
                            role="button"
                            tabIndex={0}
                            className={classNames(classes.rightSpacer, classes.part, classes.image)}
                            onClick={hideInPlaceLogin}
                        >
                            <img
                                src="/images/ld-logo-ver-091EA8500E0CBCBECE1FACC3A785855B.png"
                                height="25"
                                alt={t('PageHeader.csld')}
                            />
                        </a>
                    </Link>
                    <div className={classNames(classes.part, classes.linksPart, { 'd-none d-md-flex': !showMenu })}>
                        <HeaderNavLink route={routes.games()}>{t('PageHeader.games')}</HeaderNavLink>
                        <HeaderNavLink route={routes.calendar()}>{t('PageHeader.calendar')}</HeaderNavLink>
                        <HeaderNavLink route="https://larpy.cz" target="_blank">
                            {t('PageHeader.blog')}
                        </HeaderNavLink>
                        <HeaderNavLink route={routes.eventCreate()}>
                            <span className={classNames(classes.buttonLike, classes.buttonFull)}>
                                {t('PageHeader.addEvent')}
                            </span>
                            <span className={classNames(classes.buttonLike, classes.buttonShort)}>
                                {t('PageHeader.addEventShort')}
                            </span>
                        </HeaderNavLink>
                        <HeaderNavLink route={routes.gameCreate()}>
                            <span className={classNames(classes.buttonLike, classes.buttonFull)}>
                                {t('PageHeader.addGame')}
                            </span>
                            <span className={classNames(classes.buttonLike, classes.buttonShort)}>
                                {t('PageHeader.addGameShort')}
                            </span>
                        </HeaderNavLink>
                    </div>
                    <div className={classNames(classes.part, classes.userPart, { 'd-none d-md-flex': !showMenu })}>
                        <HeaderSearchForm />
                        <HeaderUser onInPlaceSignIn={handleToggleMenu} />
                    </div>
                    <Button
                        variant="dark"
                        className={classNames(classes.part, classes.expandButton)}
                        onClick={handleToggleMenu}
                    >
                        <IconMenu />
                    </Button>
                </WidthFixer>
            </nav>
            <div className={classes.placeholder} />
        </>
    )
}
