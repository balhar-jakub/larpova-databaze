import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col } from 'react-bootstrap'
import Link from 'next/link'
import { useTranslation } from 'src/lib/i18n'
import { GameBaseData } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { GridHeader } from './GridHeader'
import { GameEventGrid } from './GameEventGrid'
import { darkTheme } from '../../theme/darkTheme'

interface Props {
    /** Heading key in the `HomePage` namespace. */
    readonly titleKey: string
    /** Optional note under the heading ("jen hry od 5 hlasů"). */
    readonly noteKey?: string
    readonly games?: (GameBaseData | undefined)[]
    /** Where "all of them" leads — the very same list, ordered, in the catalog. */
    readonly href?: string
}

const useStyles = createUseStyles({
    note: {
        color: darkTheme.textDark,
        fontSize: '0.65rem',
        fontWeight: 400,
        textTransform: 'none',
        marginLeft: 6,
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

const gamesLoading = [undefined, undefined, undefined, undefined, undefined, undefined]

/**
 * One block of games. The homepage used to hide two blocks behind a carousel
 * whose arrows sat in the heading, so half of the games were invisible and the
 * heading said something different from what the visitor was looking at.
 */
export const HomePageGamesPanel = ({ titleKey, noteKey, games = gamesLoading, href }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={6}>
            <GridHeader>
                {t(titleKey)}
                {noteKey && <span className={classes.note}>{t(noteKey)}</span>}
            </GridHeader>
            <GameEventGrid elements={games} />
            {href && (
                <div className={classes.more}>
                    <Link href={href} legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.moreLink} href={href}>{t('HomePage.seeAll')}</a>
                    </Link>
                </div>
            )}
        </Col>
    )
}
