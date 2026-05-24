import React, { FocusEvent, useRef, useState } from 'react'
import { FieldValidator } from 'final-form'
import { useField } from 'react-final-form'
import { Form } from 'react-bootstrap'
import ReactDatePicker, { registerLocale } from 'react-datepicker'
import cs from 'date-fns/locale/cs'
import { createUseStyles } from 'react-jss'
import FieldWithError from './FieldWithError'

import 'react-datepicker/dist/react-datepicker.css'

registerLocale('cs', cs)

const useStyles = createUseStyles({
    wrapper: {
        width: '100%',
    },
})

export interface FormDateInputFieldProps {
    readonly name: string
    readonly label?: string
    readonly hint?: string
    readonly errorHint?: string
    readonly className?: string
    readonly validate?: FieldValidator<Date>
    readonly showErrorPlaceholder?: boolean
    readonly placeholder?: string
    readonly onChange?: (newValue?: Date) => void
}

const FormDateInputField = ({
    name,
    label,
    hint,
    errorHint,
    validate,
    showErrorPlaceholder,
    placeholder,
    className,
    onChange,
}: FormDateInputFieldProps) => {
    const {
        input: { onBlur: inputOnBlur, onChange: inputOnChange, value },
        meta,
    } = useField(name, { validate })
    const classes = useStyles()
    const inputRef = useRef<ReactDatePicker | null>(null)
    const [wasBlurred, setWasBlurred] = useState(false)

    const handleOnBlur = (e: FocusEvent<HTMLInputElement>) => {
        setWasBlurred(true)
        inputOnBlur?.(e)
    }

    const handleOnChange = (newValue: Date | [Date, Date] | null) => {
        if (Array.isArray(newValue)) {
            // We do not support ranges
            return
        }
        onChange?.(newValue ?? undefined)
        inputOnChange({ target: { value: newValue ?? undefined } })
    }

    const handleSelect = () => {
        window.setTimeout(() => {
            inputRef.current?.setFocus()
            inputRef.current?.setOpen(false, true)
        }, 10)
    }

    return (
        <FieldWithError
            className={`${className} mb-1`}
            meta={meta}
            showErrorPlaceholder={showErrorPlaceholder}
            hint={hint}
            errorHint={errorHint}
            hideError={!wasBlurred}
        >
            {isInvalid => (
                <>
                    {label && <Form.Label>{label}</Form.Label>}
                    <ReactDatePicker
                        locale="cs"
                        selected={value}
                        onChange={date => handleOnChange(date)}
                        onBlur={handleOnBlur}
                        dateFormat="dd.MM.yyyy"
                        placeholderText={placeholder}
                        wrapperClassName={classes.wrapper}
                        ref={inputRef}
                        customInput={<Form.Control type="text" isInvalid={isInvalid} />}
                        onSelect={handleSelect}
                    />
                </>
            )}
        </FieldWithError>
    )
}

export default FormDateInputField
