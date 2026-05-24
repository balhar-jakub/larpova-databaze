import React from 'react'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../../theme/darkTheme'
import { WidthFixer } from '../WidthFixer/WidthFixer'

interface Props {
    readonly headerText?: string
}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundNearWhite,
        padding: '16px 0',
    },
    header: {
        padding: '5px 20px',
        backgroundColor: darkTheme.backgroundRealWhite,
        fontSize: '1.25rem',
        color: darkTheme.textOnLight,
        borderBottom: '1px solid rgba(0,0,0,.1)',
    },
    body: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: 20,
    },
})

/**
 * Creates row with form on pages that contain (just) a form
 */
const FormPageRow: React.FC<Props> = ({ headerText, children }) => {
    const classes = useStyles()

    return (
        <div className={classes.row}>
            <WidthFixer>
                {headerText && <div className={classes.header}>{headerText}</div>}
                <div className={classes.body}>{children}</div>
            </WidthFixer>
        </div>
    )
}

export default FormPageRow
