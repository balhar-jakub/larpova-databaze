import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { WidthFixer } from '../WidthFixer/WidthFixer'
import { darkTheme } from '../../../theme/darkTheme'
import { IconFacebook } from '../Icons/Icons'

const useStyles = createUseStyles({
    footerWrapper: {
        borderTop: '1px solid black',
        background: darkTheme.backgroundLight,
        padding: '10px 0',
        color: darkTheme.textDark,
        fontSize: '0.8rem',
        lineHeight: '200%',
    },
    link: {
        padding: '0 5px',
        position: 'relative',
        top: 1,
        '&:hover': {
            color: darkTheme.textGreen,
        },
    },
})

export const PageFooter = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <div className={classes.footerWrapper}>
            <WidthFixer>
                <span>{t('PageFooter.copyright')}</span>
                &nbsp;&nbsp;&nbsp;
                <a
                    href="https://www.facebook.com/groups/larpovadatabaze/"
                    target="_blank"
                    rel="noreferrer"
                    className={classes.link}
                >
                    <IconFacebook />
                </a>
                <br />
                <span>{t('PageFooter.team')}</span>
            </WidthFixer>
        </div>
    )
}
