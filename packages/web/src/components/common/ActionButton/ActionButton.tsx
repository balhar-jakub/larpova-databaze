import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../../theme/darkTheme'

interface Props {
    readonly onClick: () => void
}

const useStyles = createUseStyles({
    button: {
        backgroundColor: darkTheme.backgroundWhite,
        color: darkTheme.textGreenDark,
        border: 0,
        padding: '12px 16px',
        fontSize: '0.75rem',
        width: '100%',
        textAlign: 'left',
        margin: '0 0 20px',

        '&:hover': {
            color: darkTheme.textOnLight,
        },
    },
})

const ActionButton: React.FC<Props> = ({ onClick, children }) => {
    const classes = useStyles()

    return (
        <button type="button" className={classes.button} onClick={onClick}>
            {children}
        </button>
    )
}

export default ActionButton
