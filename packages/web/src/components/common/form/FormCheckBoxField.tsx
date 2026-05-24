import React from 'react'
import { useField } from 'react-final-form'
import { Form } from 'react-bootstrap'
import { createUseStyles } from 'react-jss'
import FieldWithError from './FieldWithError'

export interface FormCheckBoxFieldProps {
    readonly name: string
    readonly showErrorPlaceholder?: boolean
    readonly label: string
    readonly hint?: string
}

const useStyles = createUseStyles({
    checkBox: {
        userSelect: 'none',
    },
})

/**
 * Convenience wrapper around FormCheckBox
 */
const FormCheckBoxField = ({ name, label, hint, showErrorPlaceholder }: FormCheckBoxFieldProps) => {
    const {
        input: { value, ...inputRest },
        meta,
    } = useField<boolean>(name, {
        type: 'checkbox',
    })
    const classes = useStyles()

    return (
        <FieldWithError meta={meta} hint={hint} showErrorPlaceholder={showErrorPlaceholder}>
            {isInvalid => (
                <Form.Check
                    isInvalid={isInvalid}
                    type={'checkbox' as any}
                    label={label}
                    id={name}
                    className={classes.checkBox}
                    checked={value}
                    /* eslint-disable-next-line react/jsx-props-no-spreading */
                    {...inputRest}
                />
            )}
        </FieldWithError>
    )
}

export default FormCheckBoxField
