import React from 'react'
import { createUseStyles } from 'react-jss'
import { GameBaseData, GameBaseDataPanel } from '../GameBaseDataPanel/GameBaseDataPanel'
import { breakPoints } from '../../../theme/breakPoints'

interface Props {
    readonly games: GameBaseData[]
}

const useStyles = createUseStyles({
    games: {
        display: 'flex',
        flexWrap: 'wrap',
    },
    game: {
        margin: '0 0 20px',
        flexBasis: '100%',
    },
    [`@media(min-width: ${breakPoints.md}px)`]: {
        games: {
            marginRight: -20,
        },
        game: {
            flexBasis: 'calc(50% - 20px)',
            margin: '0 20px 20px 0',
        },
    },
})

/**
 * List of games in detail (authored games for person / group, list of related games for event)
 */
const DetailGameList = ({ games }: Props) => {
    const classes = useStyles()

    return (
        <div className={classes.games}>
            {games.map(game => (
                <GameBaseDataPanel key={game.id} game={game} className={classes.game} variant="light" />
            ))}
        </div>
    )
}

export default DetailGameList
