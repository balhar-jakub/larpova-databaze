import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../theme/darkTheme'

const useStyles = createUseStyles({
    separator: {
        display: 'flex',
        alignItems: 'center',
        textAlign: 'center',
        color: darkTheme.textLighter,
        fontSize: '.7rem',
        margin: '6px 0',
        '&:before': {
            content: "''",
            flex: '1',
            borderBottom: `1px solid ${darkTheme.textLighter}`,
        },
        '&:after': {
            content: "''",
            flex: '1',
            borderBottom: `1px solid ${darkTheme.textLighter}`,
        },
        '&:not(:empty)::before': {
            marginRight: '1em',
        },
        '&:not(:empty)::after': {
            marginLeft: '1em',
        },
    },
})

export const MonthSeparator: React.FC = ({ children }) => {
    const classes = useStyles()
    return <div className={classes.separator}>{children}</div>
}
