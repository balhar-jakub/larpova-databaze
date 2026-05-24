import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { Game } from '../../../graphql/__generated__/typescript-operations'
import { DetailListHeader } from '../DetailListHeader/DetailListHeader'
import { darkTheme } from '../../../theme/darkTheme'
import { GameRatingBox } from '../GameRatingBox/GameRatingBox'
import { GameLink } from '../GameLink/GameLink'

interface Props {
    readonly titleKey?: string
    readonly games?: Array<Pick<Game, 'id' | 'name' | 'averageRating' | 'amountOfRatings' | 'year'>>
    readonly ratingMap?: { [key: string]: number | undefined }
}

const useStyles = createUseStyles({
    wrapper: {
        padding: 15,
        marginBottom: 12,
    },
    titleInner: {
        flexGrow: 1,
    },
    game: {
        display: 'flex',
        alignItems: 'center',
    },
    gameName: {
        minWidth: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: darkTheme.textOnLightDark,
        fontSize: '0.75rem',
        padding: '4px 6px',
        flexGrow: 1,

        '&:hover': {
            color: darkTheme.textOnLight,
        },
    },
    titleRating: {
        opacity: 0.5,
    },
    rating: {
        marginLeft: 8,
        fontSize: '0.75rem',
        opacity: 0.5,
    },
})

export const GameListPanel = ({ titleKey, games, ratingMap }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <>
            {titleKey && (
                <DetailListHeader>
                    <span className={classes.titleInner}>{t(titleKey)}</span>
                    {ratingMap && <span className={classes.titleRating}>{t('Game.ratingInList')}</span>}
                </DetailListHeader>
            )}
            {games && (
                <div className={classes.wrapper}>
                    {games.map(game => (
                        <GameLink game={game} className={classes.game} key={game.id}>
                            <GameRatingBox
                                amountOfRatings={game.amountOfRatings}
                                rating={game.averageRating}
                                size="tiny"
                            />
                            <span className={classes.gameName}>
                                {game.name} ({game.year || '?'})
                            </span>
                            {ratingMap && ratingMap[game.id] && (
                                <span className={classes.rating}>{ratingMap[game.id]}</span>
                            )}
                        </GameLink>
                    ))}
                </div>
            )}
        </>
    )
}
