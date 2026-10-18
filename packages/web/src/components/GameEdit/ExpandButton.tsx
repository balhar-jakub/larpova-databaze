import React from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { ChevronDown } from 'react-bootstrap-icons'
import { formClasses } from '../../utils/formClasses'

const useStyles = createUseStyles(formClasses)

interface Props {
    readonly label: string
    readonly onClick: () => void
    readonly className?: string
}

/**
 * The one-way "reveal the rest of the form" control, in the shape the event form
 * already uses (`EventEditForm`): a plain text button with a chevron, rendered
 * only while its section is still hidden. The event form proved the pattern, so
 * the game form reuses it instead of inventing a second one.
 */
const ExpandButton = ({ label, onClick, className }: Props) => {
    const classes = useStyles()

    return (
        <button type="button" onClick={onClick} className={classNames(classes.expandButton, className)}>
            {label}
            <ChevronDown className={classes.expandArrow} />
        </button>
    )
}

export default ExpandButton
