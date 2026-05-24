import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from 'src/theme/darkTheme'

const useStyles = createUseStyles({
    panel: {
        backgroundColor: darkTheme.backgroundLight,
    },
})

const FormPanel: React.FC<{}> = ({ children }) => {
    const classes = useStyles()

    return <div className={classes.panel}>{children}</div>
}

export default FormPanel
