import React from 'react'
import { useField } from 'react-final-form'
import { Form } from 'react-bootstrap'
import FieldWithError from './FieldWithError'

export interface FormSelectOption {
    readonly value: string
    readonly label: string
}

export interface FormSelectFieldProps {
    readonly name: string
    readonly label?: string
    readonly hint?: string
    readonly options: FormSelectOption[]
    readonly showErrorPlaceholder?: boolean
}

/**
 * Convenience wrapper around a bootstrap `Form.Control as="select"`.
 */
const FormSelectField = ({ name, label, hint, options, showErrorPlaceholder }: FormSelectFieldProps) => {
    const { input, meta } = useField<string>(name, { type: 'select' })

    return (
        <FieldWithError className="mb-1" meta={meta} hint={hint} showErrorPlaceholder={showErrorPlaceholder}>
            {isInvalid => (
                <>
                    {label && <Form.Label htmlFor={name}>{label}</Form.Label>}
                    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                    <Form.Control as="select" id={name} isInvalid={isInvalid} {...input}>
                        {options.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </Form.Control>
                </>
            )}
        </FieldWithError>
    )
}

export default FormSelectField
