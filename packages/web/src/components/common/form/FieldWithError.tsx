import React from 'react'
import { FieldMetaState } from 'react-final-form'
import { createUseStyles } from 'react-jss'
import { Form } from 'react-bootstrap'
import { darkTheme } from '../../../theme/darkTheme'

interface Props {
    readonly controlId?: string
    readonly meta: FieldMetaState<any>
    readonly showErrorPlaceholder?: boolean
    readonly hint?: string
    readonly children: (isInvalid: boolean) => React.ReactNode
    readonly errorHint?: React.ReactNode
    readonly hideError?: boolean
    readonly className?: string
}

const useStyles = createUseStyles({
    hintHolder: {
        color: darkTheme.text,
    },
    forcedFeedback: {
        display: 'block',
    },
})

const FieldWithError: React.FC<Props> = ({
    meta,
    hint,
    showErrorPlaceholder = true,
    errorHint,
    controlId,
    hideError = false,
    className,
    children,
}) => {
    const showError = ((!hideError && (meta.touched || meta.modified)) || meta.submitFailed) && meta.error
    const classes = useStyles()

    return (
        <Form.Group controlId={controlId} className={className}>
            {children(!!showError || !!errorHint)}
            {/* Autocomplete (AsyncTypeahead) does not work properly with Feedback so we must force-show it */}
            {showError && (
                <Form.Control.Feedback type="invalid" className={classes.forcedFeedback}>
                    {meta.error}
                </Form.Control.Feedback>
            )}
            {!showError && errorHint}
            {!showError && !errorHint && (hint || showErrorPlaceholder) && (
                <Form.Text className={classes.hintHolder}>{hint || '\u00A0'}</Form.Text>
            )}
        </Form.Group>
    )
}

export default FieldWithError
