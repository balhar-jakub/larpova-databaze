import React from 'react'
import { createUseStyles } from 'react-jss'
import { GameRatingBox } from '../GameRatingBox'

export default { title: 'GameRatingBox' }

const useStyles = createUseStyles({
    row: {
        padding: 10,
        display: 'flex',
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

export const Tiny = () => {
    const classes = useStyles()

    return (
        <div className={classes.row}>
            <GameRatingBox amountOfRatings={0} rating={70} size="tiny" className={classes.margin} />
            <GameRatingBox amountOfRatings={10} rating={30} size="tiny" className={classes.margin} />
            <GameRatingBox amountOfRatings={10} rating={65} size="tiny" className={classes.margin} />
            <GameRatingBox amountOfRatings={10} rating={100} size="tiny" className={classes.margin} />
        </div>
    )
}

export const Small = () => {
    const classes = useStyles()

    return (
        <div className={classes.row}>
            <GameRatingBox amountOfRatings={0} rating={70} size="small" className={classes.margin} />
            <GameRatingBox amountOfRatings={10} rating={30} size="small" className={classes.margin} />
            <GameRatingBox amountOfRatings={10} rating={65} size="small" className={classes.margin} />
            <GameRatingBox amountOfRatings={10} rating={100} size="small" className={classes.margin} />
        </div>
    )
}

export const Medium = () => {
    const classes = useStyles()
    const className = `${classes.margin} ${classes.mediumWidth}`

    return (
        <div className={classes.row}>
            <GameRatingBox amountOfRatings={0} rating={70} averageRating={58} size="medium" className={className} />
            <GameRatingBox amountOfRatings={10} rating={10} averageRating={16} size="medium" className={className} />
            <GameRatingBox amountOfRatings={10} rating={65} averageRating={62} size="medium" className={className} />
            <GameRatingBox amountOfRatings={10} rating={100} averageRating={100} size="medium" className={className} />
        </div>
    )
}

export const Big = () => {
    const classes = useStyles()
    const className = `${classes.margin} ${classes.bigWidth}`

    return (
        <div className={classes.row}>
            <GameRatingBox amountOfRatings={0} rating={70} size="big" className={className} />
            <GameRatingBox amountOfRatings={10} rating={30} size="big" className={className} />
            <GameRatingBox amountOfRatings={10} rating={65} size="big" className={className} />
            <GameRatingBox amountOfRatings={10} rating={100} size="big" className={className} />
        </div>
    )
}
