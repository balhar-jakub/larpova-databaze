import React from 'react'
import { createUseStyles } from 'react-jss'
import { GameRatingBox } from '../GameRatingBox'

export default { title: 'GameRatingBox' }

const useStyles = createUseStyles({
    row: {
        padding: 10,
        display: 'flex',
        alignItems: 'center',
    },
    margin: {
        margin: '0 5px',
    },
    mediumWidth: {
        width: 145,
    },
    bigWidth: {
        width: 132,
    },
})

/** The five levels plus the "too few ratings" state, in the order the input shows them. */
const STATES = [
    { key: 'stronglyRecommended', rating: 95 },
    { key: 'recommended', rating: 78 },
    { key: 'neutral', rating: 60 },
    { key: 'notRecommended', rating: 40 },
    { key: 'stronglyNotRecommended', rating: 20 },
    { key: 'notrated', rating: 95 },
]

const Boxes = ({ size, className }: { size: 'tiny' | 'small' | 'medium' | 'big'; className?: string }) => (
    <>
        {STATES.map(state => {
            const classes = `${className ?? ''}`
            const rates = state.key === 'notrated' ? 0 : 10

            return (
                <GameRatingBox
                    key={state.key}
                    amountOfRatings={rates}
                    rating={state.rating}
                    size={size}
                    className={classes}
                />
            )
        })}
    </>
)

export const Tiny = () => {
    const classes = useStyles()

    return (
        <div className={classes.row}>
            <Boxes size="tiny" className={classes.margin} />
        </div>
    )
}

export const Small = () => {
    const classes = useStyles()

    return (
        <div className={classes.row}>
            <Boxes size="small" className={classes.margin} />
        </div>
    )
}

export const Medium = () => {
    const classes = useStyles()

    return (
        <div className={classes.row}>
            <Boxes size="medium" className={`${classes.margin} ${classes.mediumWidth}`} />
        </div>
    )
}

export const Big = () => {
    const classes = useStyles()

    return (
        <div className={classes.row}>
            <Boxes size="big" className={`${classes.margin} ${classes.bigWidth}`} />
        </div>
    )
}
