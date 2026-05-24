import React from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { Container } from 'react-bootstrap'

interface Props {
    readonly className?: string
}

const useStyles = createUseStyles({
    widthFixer: {
        margin: '0 auto',
        // padding: '0 15px',
        boxSizing: 'border-box',
    },
})

export const WidthFixer: React.FC<Props> = ({ className, children }) => {
    const classes = useStyles()

    return <Container className={classNames(classes.widthFixer, className)}>{children}</Container>
}
