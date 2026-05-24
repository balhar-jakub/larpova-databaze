import React from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { GameBaseData, GameBaseDataPanel } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { darkTheme } from '../../theme/darkTheme'
import { EventBaseData, EventBaseDataPanel } from './EventBaseDataPanel'
import { breakPoints } from '../../theme/breakPoints'

const useStyles = createUseStyles({
    grid: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: darkTheme.background,
        margin: '0 -10px',
        justifyContent: 'center',
    },
    element: {
        margin: 10,
        width: '100%',
    },

    [`@media(min-width: ${breakPoints.md}px)`]: {
        element: {
            width: 260,
        },
    },
})

interface Props {
    readonly elements: (GameBaseData | EventBaseData | undefined)[]
    readonly className?: string
}

const isGame = (element: GameBaseData | EventBaseData): element is GameBaseData =>
    (element as any).players !== undefined

const isEvent = (element: GameBaseData | EventBaseData): element is EventBaseData =>
    (element as any).amountOfPlayers !== undefined

/**
 * Grid for games or events
 */
export const GameEventGrid = ({ elements, className }: Props) => {
    const classes = useStyles()

    return (
        <div className={classNames(classes.grid, className)}>
            {elements.map((element, n) => {
                if (element === undefined || isEvent(element)) {
                    return (
                        <EventBaseDataPanel event={element} className={classes.element} key={element?.id || `e_${n}`} />
                    )
                }
                if (isGame(element)) {
                    return (
                        <GameBaseDataPanel game={element} className={classes.element} key={element.id} variant="dark" />
                    )
                }
                return ''
            })}
        </div>
    )
}
