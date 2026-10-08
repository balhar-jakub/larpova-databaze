import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { MIN_NUM_RATINGS } from '../../utils/ratingUtils'
import { GameRatingBox } from '../common/GameRatingBox/GameRatingBox'
import { GameLink } from '../common/GameLink/GameLink'
import { componentTestIds } from '../componentTestIds'
import HighlightedText from './HighlightedText'
import { GameRowData, gameMatchReason, labelsToShow } from './searchHelpers'

interface Props {
    readonly game: GameRowData
    /** What the visitor typed — the row shows where it hit. */
    readonly query?: string | null
}

const useStyles = createUseStyles({
    row: {
        display: 'grid',
        gridTemplateColumns: '56px 1fr 150px',
        gap: 12,
        alignItems: 'center',
        background: darkTheme.backgroundRealWhite,
        borderRadius: 6,
        padding: '9px 14px',
        marginBottom: 7,
        color: darkTheme.textOnLightDark,
    },
    badge: {
        width: 48,
        height: 48,
    },
    /**
     * Two thirds of the games in a result list have fewer than five votes. The
     * badge is a 145 px grey square in the ladder rows; here it would eat a
     * quarter of the row for nothing, so the empty state is a dash.
     */
    notRated: {
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px dashed ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 5,
        color: darkTheme.textDark,
        fontSize: '1.1rem',
    },
    main: {
        minWidth: 0,
    },
    name: {
        fontSize: '1rem',
        fontWeight: 600,
    },
    meta: {
        fontSize: '0.74rem',
        color: darkTheme.textOnLightLighter,
        marginTop: 2,
    },
    year: {
        fontWeight: 700,
        color: darkTheme.textOnLight,
    },
    author: {
        color: darkTheme.textOnLight,
    },
    more: {
        color: darkTheme.textGreenDark,
    },
    missing: {
        fontStyle: 'italic',
    },
    why: {
        display: 'inline-block',
        marginTop: 4,
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#0f4f4a',
        background: '#d9f2ec',
        borderRadius: 9,
        padding: '1px 8px',
    },
    stats: {
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
        textAlign: 'right',
    },
    statsStrong: {
        color: darkTheme.textOnLightDark,
        fontWeight: 700,
    },
    [`@media(max-width: 575px)`]: {
        row: {
            gridTemplateColumns: '48px 1fr',
        },
        stats: {
            gridColumn: 2,
            textAlign: 'left',
        },
    },
})

/**
 * One game in the search results. What the ladder row does not do and this one
 * has to: it says *why* the game is in the list (the engine also matches authors
 * and groups), it highlights the words the visitor typed, it labels the numbers
 * — the ladder row shows a bare `20x` next to an icon — and it keeps the label
 * line to three labels so every row is the same height.
 */
export const SearchGameRow = ({ game, query }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const rated = game.amountOfRatings >= MIN_NUM_RATINGS
    const { shown, more } = labelsToShow(game.labels)
    const reason = gameMatchReason(game, query)
    const authors = (game.authors ?? []).map(author => author.name)
    const authorNames =
        authors.length > 3 ? `${authors.slice(0, 3).join(', ')} +${authors.length - 3}` : authors.join(', ')

    return (
        <div className={classes.row} data-testid={componentTestIds.search.gameRow(game.id)}>
            {rated ? (
                <GameRatingBox
                    className={classes.badge}
                    amountOfRatings={game.amountOfRatings}
                    rating={game.totalRating}
                    averageRating={game.averageRating}
                    size="medium"
                />
            ) : (
                <div className={classes.notRated} title={t('Search.noRating')} data-testid={componentTestIds.search.notRated}>
                    –
                </div>
            )}
            <div className={classes.main}>
                <div className={classes.name}>
                    <GameLink game={game} className={classes.name}>
                        <HighlightedText text={game.name} query={query} />
                    </GameLink>
                </div>
                <div className={classes.meta}>
                    <span className={classes.year}>{game.year ?? t('Search.yearUnknown')}</span>
                    {' · '}
                    {shown.length > 0 ? (
                        <>
                            {shown.join(', ')}
                            {more > 0 && <span className={classes.more}> {t('Search.labelsMore', { count: more })}</span>}
                        </>
                    ) : (
                        <span className={classes.missing}>{t('Search.noLabels')}</span>
                    )}
                    {authors.length > 0 && (
                        <>
                            {' · '}
                            <span className={classes.author}>
                                {t('Search.gameAuthors', { names: authorNames })}
                            </span>
                        </>
                    )}
                </div>
                {reason && (
                    <div className={classes.why} data-testid={componentTestIds.search.matchReason(game.id)}>
                        {t(reason.kind === 'author' ? 'Search.matchAuthor' : 'Search.matchGroup', { name: reason.name })}
                    </div>
                )}
            </div>
            <div className={classes.stats}>
                <div className={classes.statsStrong}>
                    {rated ? `${Math.round(game.averageRating)} %` : t('Search.noRating')}
                </div>
                <div>{t('Search.ratingCount', { count: game.amountOfRatings })}</div>
                <div>{t('Search.commentCount', { count: game.amountOfComments })}</div>
            </div>
        </div>
    )
}

export default SearchGameRow
