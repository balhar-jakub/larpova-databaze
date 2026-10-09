import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col } from 'react-bootstrap'
import Link from 'next/link'
import { format } from 'date-fns-tz'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { parseDateTime } from '../../utils/dateUtils'
import { getRecommendationForTenPointRating, recommendationKey } from '../../utils/ratingUtils'
import { GameBaseData } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { GameLink } from '../common/GameLink/GameLink'
import { bandClassName, ratingIcon, ratingStyles } from '../common/GameRatingBox/GameRatingBox'
import { componentTestIds } from '../componentTestIds'
import { GridHeader } from './GridHeader'

interface AuthoredRow {
    readonly game?: GameBaseData
    readonly lastRating?: {
        readonly rating: number
        readonly added?: string | null
    } | null
}

interface Props {
    readonly authored?: AuthoredRow[]
    readonly authoredCount?: number
}

const useStyles = createUseStyles({
    head: {
        display: 'flex',
        color: darkTheme.textDark,
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        borderBottom: `1px solid ${darkTheme.backgroundControl}`,
        paddingBottom: 4,
        marginBottom: 4,
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        padding: '5px 0',
    },
    name: {
        flexGrow: 1,
        minWidth: 0,
        color: darkTheme.text,
        fontSize: '0.78rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    vote: {
        width: 46,
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0,
    },
    voteBadge: {
        width: 11,
        height: 11,
        borderRadius: 2,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: darkTheme.textLight,
        fontSize: '0.5rem',
    },
    when: {
        width: 86,
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        flexShrink: 0,
        textAlign: 'right',
    },
    more: {
        textAlign: 'center',
        marginTop: 6,
    },
    moreLink: {
        color: darkTheme.textGreen,
        fontSize: '0.72rem',
    },
    ...ratingStyles,
})

/**
 * The single last vote as the same colour square the games carry in lists
 * (`GameRatingBox` in tiny size): the band colour of the 1-10 vote, with the
 * recommendation icon on top. The voter is not shown — who rated the game is
 * not the author's business.
 */
const VoteBadge = ({ rating, label }: { readonly rating: number; readonly label: string }) => {
    const classes = useStyles()
    const recommendation = getRecommendationForTenPointRating(rating)
    const RatingIcon = ratingIcon[recommendation]

    return (
        <span
            className={`${classes.voteBadge} ${classes[bandClassName[recommendation]]}`}
            data-testid={componentTestIds.homeAuthored.voteBadge}
            role="img"
            aria-label={label}
            title={label}
        >
            <RatingIcon />
        </span>
    )
}

/**
 * The visitor's own games with the newest rating each received. Before this the
 * author had to open every one of their games to find out whether anything had
 * happened — fifteen detail pages for a single answer.
 */
export const HomeAuthoredPanel = ({ authored = [], authoredCount }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={6} data-testid={componentTestIds.homeAuthored.panel}>
            <GridHeader>{t('HomePage.authored')}</GridHeader>
            <div className={classes.head}>
                <span className={classes.name}>{t('HomePage.authoredGame')}</span>
                <span className={classes.vote}>{t('HomePage.authoredLastRating')}</span>
                <span className={classes.when}>{t('HomePage.authoredWhen')}</span>
            </div>
            {authored.map((row) =>
                row.game ? (
                    <div className={classes.row} key={row.game.id} data-testid={componentTestIds.homeAuthored.row(row.game.id)}>
                        <GameLink game={row.game} className={classes.name}>{row.game.name}</GameLink>
                        <span className={classes.vote}>
                            {row.lastRating ? (
                                <VoteBadge
                                    rating={row.lastRating.rating}
                                    label={t(recommendationKey(getRecommendationForTenPointRating(row.lastRating.rating)))}
                                />
                            ) : null}
                        </span>
                        <span className={classes.when}>
                            {row.lastRating?.added ? format(parseDateTime(row.lastRating.added) || 0, 'dd.MM.yyyy') : ''}
                        </span>
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
