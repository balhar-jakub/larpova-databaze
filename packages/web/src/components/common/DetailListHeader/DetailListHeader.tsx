import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../../theme/darkTheme'

const useStyles = createUseStyles({
    wrapper: {
        backgroundColor: darkTheme.backgroundWhite,
        fontSize: '0.83rem',
        color: darkTheme.textOnLight,
        padding: '10px 15px',
        borderRadius: 3,
        margin: 0,
        display: 'flex',
    },
})

export const DetailListHeader: React.FC<{}> = ({ children }) => {
    const classes = useStyles()

    return <h2 className={classes.wrapper}>{children}</h2>
}
