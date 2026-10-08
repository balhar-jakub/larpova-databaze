import React from 'react'
import { createUseStyles } from 'react-jss'
import Link from 'next/link'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'

interface Props {
    readonly name?: string | null
}

const useStyles = createUseStyles({
    band: {
        backgroundColor: darkTheme.background,
        padding: '30px 0 22px',
    },
    inner: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
    },
    title: {
        color: darkTheme.text,
        fontSize: '1.4rem',
        fontWeight: 700,
        margin: '0 0 8px',
    },
    text: {
        color: darkTheme.textDark,
        fontSize: '0.8rem',
        maxWidth: 620,
        margin: '0 0 16px',
    },
    steps: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    step: {
        display: 'block',
        width: 240,
        borderRadius: 4,
        margin: '0 6px 10px',
        padding: 14,
        textAlign: 'left',
        backgroundColor: darkTheme.backgroundLight,
        color: darkTheme.text,
        '&:hover': {
            backgroundColor: darkTheme.backgroundHover,
            color: darkTheme.text,
        },
    },
    stepTitle: {
        display: 'block',
        fontSize: '0.78rem',
        fontWeight: 700,
        marginBottom: 4,
    },
    stepText: {
        display: 'block',
        color: darkTheme.textDark,
        fontSize: '0.7rem',
    },
})

/**
 * The signed-in visitor whose larpotéka is empty — 1 146 of 3 170 accounts
 * (36 %). Without this band the page would be five empty blocks; the anonymous
 * content below it (best rated, newest, upcoming events) is what they get
 * instead, and these three steps are how they stop being in that group.
 */
export const HomeEmptyPanel = ({ name }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const steps = [
        { href: '/profile/current', title: t('HomePage.emptyStepProfile'), text: t('HomePage.emptyStepProfileText') },
        { href: '/games', title: t('HomePage.emptyStepCatalog'), text: t('HomePage.emptyStepCatalogText') },
        { href: '/gameEdit', title: t('HomePage.emptyStepGame'), text: t('HomePage.emptyStepGameText') },
    ]

    return (
        <div className={classes.band}>
            <WidthFixer className={classes.inner}>
                <h1 className={classes.title}>{t('HomePage.emptyTitle', { name: name ?? '' })}</h1>
                <p className={classes.text}>{t('HomePage.emptyText')}</p>
                <div className={classes.steps}>
                    {steps.map((step) => (
                        <Link key={step.href} href={step.href} legacyBehavior>
                            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                            <a className={classes.step} href={step.href}>
                                <span className={classes.stepTitle}>{step.title}</span>
                                <span className={classes.stepText}>{step.text}</span>
                            </a>
                        </Link>
                    ))}
                </div>
            </WidthFixer>
        </div>
    )
}
