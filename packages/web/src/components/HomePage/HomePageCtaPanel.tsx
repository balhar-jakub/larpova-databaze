import React from 'react'
import { createUseStyles } from 'react-jss'
import Link from 'next/link'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'

interface Props {
    readonly signUpHref: string
    readonly createGameHref: string
}

const useStyles = createUseStyles({
    band: {
        backgroundColor: darkTheme.backgroundLight,
        padding: '30px 0',
    },
    inner: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
    },
    title: {
        color: darkTheme.text,
        fontSize: '1.05rem',
        fontWeight: 700,
        margin: '0 0 8px',
    },
    text: {
        color: darkTheme.textDark,
        fontSize: '0.8rem',
        maxWidth: 620,
        margin: '0 0 18px',
    },
    buttons: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    primary: {
        display: 'inline-block',
        borderRadius: 4,
        margin: '0 5px 8px',
        padding: '10px 20px',
        fontSize: '0.78rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: darkTheme.textOnLightDark,
        backgroundColor: darkTheme.backgroundRealWhite,
        '&:hover': {
            backgroundColor: darkTheme.backgroundAlmostNearWhite,
            color: darkTheme.textOnLightDark,
        },
    },
    secondary: {
        display: 'inline-block',
        borderRadius: 4,
        margin: '0 5px 8px',
        padding: '10px 20px',
        fontSize: '0.78rem',
        color: darkTheme.text,
        border: `1px solid ${darkTheme.backgroundControl}`,
        '&:hover': {
            backgroundColor: darkTheme.backgroundHover,
            color: darkTheme.text,
        },
    },
})

/**
 * The closing band: the homepage of a database that is filled by its visitors
 * has to ask for the contribution somewhere. Both buttons lead to a page that
 * already exists (registration, new game); nothing here needs an account.
 */
export const HomePageCtaPanel = ({ signUpHref, createGameHref }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <div className={classes.band}>
            <WidthFixer className={classes.inner}>
                <h2 className={classes.title}>{t('HomePage.ctaTitle')}</h2>
                <p className={classes.text}>{t('HomePage.ctaText')}</p>
                <div className={classes.buttons}>
                    <Link href={signUpHref} legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.primary} href={signUpHref}>{t('HomePage.ctaSignUp')}</a>
                    </Link>
                    <Link href={createGameHref} legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.secondary} href={createGameHref}>{t('HomePage.ctaCreateGame')}</a>
                    </Link>
                </div>
            </WidthFixer>
        </div>
    )
}
