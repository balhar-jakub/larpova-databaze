import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { DetailListHeader } from '../common/DetailListHeader/DetailListHeader'
import { GameRatingBox } from '../common/GameRatingBox/GameRatingBox'
import { GameLink } from '../common/GameLink/GameLink'
import { Series } from '../../graphql/__generated__/typescript-operations'

interface Props {
    readonly series: Series | null | undefined
    /** The game whose detail this panel sits on — highlighted in the instalment list. */
    readonly currentGameId: string
}

const useStyles = createUseStyles({
    wrapper: {
        padding: 15,
        marginBottom: 12,
    },
    summary: {
        color: darkTheme.textOnLightLighter,
        fontSize: '0.72rem',
        paddingBottom: 8,
        borderBottom: `1px solid #e2e2e2`,
        marginBottom: 6,
    },
    instalment: {
        display: 'flex',
        alignItems: 'center',
        padding: '4px 6px',
        borderRadius: 3,
        '&$current': {
            backgroundColor: '#ececec',
        },
    },
    current: {},
    year: {
        color: darkTheme.textOnLightLighter,
        fontSize: '0.75rem',
        minWidth: 40,
    },
    gameName: {
        minWidth: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: darkTheme.textOnLightDark,
        fontSize: '0.75rem',
        flexGrow: 1,

        '&:hover': {
            color: darkTheme.textOnLight,
        },
    },
    thisGame: {
        color: darkTheme.textOnLightLighter,
        fontSize: '0.68rem',
        fontStyle: 'italic',
    },
})

/**
 * "Série" panel of the game detail: the series this game is an instalment of,
 * with all instalments (the current one highlighted). Mirrors the panel family
 * of the right column (DetailListHeader + white body, GameRatingBox tiny badges)
 * so it reads as one of the existing panels, not a new design.
 */
export const SeriesListPanel = ({ series, currentGameId }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    if (!series || !series.games?.length) {
        return null
    }

    const years =
        series.firstYear && series.lastYear && series.firstYear !== series.lastYear
            ? `${series.firstYear}–${series.lastYear}`
            : `${series.firstYear ?? '?'}`

    return (
        <>
            <DetailListHeader>
                {t('GameDetail.series')}: {series.name ?? ''} ({series.amountOfGames})
            </DetailListHeader>
            <div className={classes.wrapper}>
                <div className={classes.summary}>
                    {years} · {series.amountOfRatings} {t('GameDetail.seriesRatings')} ·{' '}
                    {series.amountOfPlayed} {t('GameDetail.seriesPlayed')}
                </div>
                {series.games.map(game => {
                    const isCurrent = String(game.id) === String(currentGameId)
                    return (
                        <GameLink
                            game={game}
                            className={`${classes.instalment} ${isCurrent ? classes.current : ''}`}
                            key={game.id}
                        >
                            <span className={classes.year}>{game.year ?? '?'}</span>
                            <GameRatingBox
                                amountOfRatings={game.amountOfRatings ?? 0}
                                rating={game.averageRating ?? 0}
                                size="tiny"
                            />
                            <span className={classes.gameName}>{game.name}</span>
                            {isCurrent && (
                                <span className={classes.thisGame}>
                                    {t('GameDetail.seriesInstalment')}
                                </span>
                            )}
                        </GameLink>
                    )
                })}
            </div>
        </>
    )
}

export default SeriesListPanel
