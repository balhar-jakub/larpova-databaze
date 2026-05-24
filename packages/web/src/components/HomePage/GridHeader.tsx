import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../theme/darkTheme'

interface Props {}

const useStyles = createUseStyles({
    gridHeader: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        color: darkTheme.text,
        textTransform: 'uppercase',
        fontWeight: 700,
        fontSize: '0.85rem',
        height: 25,
        margin: '20px 0 5px',
    },
})

export const GridHeader: React.FC<Props> = ({ children }) => {
    const classes = useStyles()
    return <div className={classes.gridHeader}>{children}</div>
}
