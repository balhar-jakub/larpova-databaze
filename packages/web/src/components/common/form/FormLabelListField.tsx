import React from 'react'
import { useField } from 'react-final-form'
import { Form } from 'react-bootstrap'
import { FieldValidator } from 'final-form'
import { createUseStyles } from 'react-jss'
import { Label } from '../../../graphql/__generated__/typescript-operations'
import FormCheckLabelWithTooltip from './FormCheckLabelWithTooltip'

export type LabelInList = Pick<Label, 'id' | 'name' | 'description'>

interface Props {
    readonly name: string
    readonly labels: Array<LabelInList>
    readonly validate?: FieldValidator<string[]>
    readonly onChange?: (newValue: string[]) => void
}

const useStyles = createUseStyles({
    checkBox: {
        userSelect: 'none',
    },
})

const FormLabelListField = ({ name, labels, validate, onChange }: Props) => {
    const {
        input: { value, onChange: inputOnChange },
        meta: { error, submitFailed },
    } = useField<string[]>(name, { validate })
    const classes = useStyles()

    const hasError = !!error && submitFailed

    const handleChange = (id: string) => () => {
        const index = value.indexOf(id)
        let newValue: string[]
        if (index >= 0) {
            newValue = value.filter(oldId => oldId !== id)
        } else {
            newValue = [...value, id]
        }
        inputOnChange({ target: { value: newValue } })
        onChange?.(newValue)
    }

    const lastIndex = labels.length - 1

    return (
        <Form.Group>
            {labels.map((label, index) => (
                <Form.Check
                    key={label.id}
                    isInvalid={hasError}
                    type={'checkbox' as any}
                    id={`${name}_${label.id}`}
                    className={classes.checkBox}
                >
                    <Form.Check.Input
                        type={'checkbox' as any}
                        isInvalid={hasError}
                        checked={value.includes(label.id)}
                        onChange={handleChange(label.id)}
                    />
                    <FormCheckLabelWithTooltip label={label.name} tooltip={label.description} tooltipId={label.id} />
                    {index === lastIndex && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
                </Form.Check>
            ))}
        </Form.Group>
    )
}

export default FormLabelListField
