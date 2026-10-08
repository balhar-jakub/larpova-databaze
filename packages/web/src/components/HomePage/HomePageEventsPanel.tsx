import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { Col } from 'react-bootstrap'
import Link from 'next/link'
import { EventBaseData } from './EventBaseDataPanel'
import { darkTheme } from '../../theme/darkTheme'
import { GameEventGrid } from './GameEventGrid'
import { GridHeader } from './GridHeader'

interface Props {
    readonly nextEvents?: (EventBaseData | undefined)[]
    readonly href?: string
}

const useStyles = createUseStyles({
    wrapper: {
        backgroundColor: darkTheme.background,
    },
    more: {
        textAlign: 'center',
        marginTop: 5,
    },
    moreLink: {
        color: darkTheme.textGreen,
        fontSize: '0.72rem',
        cursor: 'pointer',
    },
})

const loadingEvents = [undefined, undefined, undefined, undefined, undefined, undefined]

export const HomePageEventsPanel = ({ nextEvents = loadingEvents, href }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={12} className={classes.wrapper}>
            <GridHeader>{t('HomePage.nextEvents')}</GridHeader>
            <GameEventGrid elements={nextEvents} />
            {href && (
                <div className={classes.more}>
                    <Link href={href} legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.moreLink} href={href}>{t('HomePage.seeCalendar')}</a>
                    </Link>
                </div>
            )}
        </Col>
    )
}
