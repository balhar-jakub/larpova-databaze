import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../../theme/darkTheme'
import { IconLoading } from '../Icons/Icons'

const useStyles = createUseStyles({
    icon: {
        display: 'block',
        fontSize: '15rem',
        margin: '40px auto',
        color: darkTheme.text,
        opacity: 0.2,
    },
})

const BigLoading = () => {
    const classes = useStyles()

    return <IconLoading className={classes.icon} />
}

export default BigLoading
