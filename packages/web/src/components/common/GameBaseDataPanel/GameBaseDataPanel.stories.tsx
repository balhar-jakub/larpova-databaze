import React from 'react'
import { createUseStyles } from 'react-jss'
import { Game } from 'src/graphql/__generated__/typescript-operations'
import { darkTheme } from '../../../theme/darkTheme'
import { GameBaseDataPanel } from './GameBaseDataPanel'

export default { title: 'GameBaseDataPanel' }

const useStyles = createUseStyles({
    wrapper: {
        width: 275,
        padding: 20,
        backgroundColor: darkTheme.background,
    },
})

const mockGreatGame = {
    id: '123',
    name: 'Bitva o Fort',
    totalRating: 95,
    players: 150,
    amountOfComments: 12,
    amountOfRatings: 23,
} as Game

const mockAverageGame = {
    id: '123',
    name: 'De Profundis: Ticho před bouří',
    totalRating: 65,
    players: 4,
    amountOfComments: 0,
    amountOfRatings: 1,
} as Game

const mockNotRatedGame = {
    id: '123',
    name: 'Křížová výprava chudiny 1096 premium',
    totalRating: 0,
    players: 38,
    amountOfComments: 0,
    amountOfRatings: 0,
} as Game

const tooFewRatingsGame = {
    id: '123',
    name: 'Křížová výprava chudiny 1096 premium',
    totalRating: 80,
    players: 38,
    amountOfComments: 0,
    amountOfRatings: 3,
} as Game

export const GreatGame = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <GameBaseDataPanel game={mockGreatGame} variant="dark" />
        </div>
    )
}

export const NotRatedGame = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <GameBaseDataPanel game={mockNotRatedGame} variant="dark" />
        </div>
    )
}

export const TooFewRatingsGame = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <GameBaseDataPanel game={tooFewRatingsGame} variant="dark" />
        </div>
    )
}

export const AverageGame = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <GameBaseDataPanel game={mockAverageGame} variant="dark" />
        </div>
    )
}

export const GreatGameLight = () => {
    const classes = useStyles()

    return (
        <div className={classes.wrapper}>
            <GameBaseDataPanel game={mockGreatGame} variant="light" />
        </div>
    )
}
