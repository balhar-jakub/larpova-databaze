import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col } from 'react-bootstrap'
import Link from 'next/link'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { GameBaseData } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { GameLink } from '../common/GameLink/GameLink'
import { GameRatingBox } from '../common/GameRatingBox/GameRatingBox'
import { componentTestIds } from '../componentTestIds'
import { GridHeader } from './GridHeader'

interface Props {
    readonly authored?: (GameBaseData | undefined)[]
    readonly authoredCount?: number
}

const useStyles = createUseStyles({
    row: {
        display: 'flex',
        alignItems: 'center',
        padding: '5px 0',
    },
    link: {
        display: 'flex',
        alignItems: 'center',
        flexGrow: 1,
        minWidth: 0,
    },
    name: {
        flexGrow: 1,
        minWidth: 0,
        color: darkTheme.text,
        fontSize: '0.78rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginLeft: 8,
    },
    more: {
        textAlign: 'center',
        marginTop: 6,
    },
    moreLink: {
        color: darkTheme.textGreen,
        fontSize: '0.72rem',
    },
})

/**
 * The visitor's own games, best rated first — the same order the catalog's
 * "best rated" list uses. The rating shows as the same recommendation icon the
 * games carry everywhere else; an individual last vote is deliberately not
 * shown: the date of a single vote sits next to dates in the other blocks and
 * naming the voter leaks who rated the author's game to the author's page.
 */
export const HomeAuthoredPanel = ({ authored = [], authoredCount }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={6} data-testid={componentTestIds.homeAuthored.panel}>
            <GridHeader>{t('HomePage.authored')}</GridHeader>
            {authored.map((game) =>
                game ? (
                    <div className={classes.row} key={game.id} data-testid={componentTestIds.homeAuthored.row(game.id)}>
                        <GameLink game={game} className={classes.link}>
                            <GameRatingBox amountOfRatings={game.amountOfRatings} rating={game.averageRating} size="tiny" />
                            <span className={classes.name}>{game.name}</span>
                        </GameLink>
                    </div>
                ) : null,
            )}
            {authoredCount != null && authoredCount > authored.length && (
                <div className={classes.more}>
                    <Link href="/profile/current" legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.moreLink} href="/profile/current">
                            {t('HomePage.authoredMore', { count: authoredCount - authored.length })}
                        </a>
                    </Link>
                </div>
            )}
        </Col>
    )
}
