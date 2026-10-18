import React from 'react'
import { useField } from 'react-final-form'
import { Form } from 'react-bootstrap'
import { FieldValidator } from 'final-form'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { Label } from '../../../graphql/__generated__/typescript-operations'
import FormCheckLabelWithTooltip from './FormCheckLabelWithTooltip'
import { breakPoints } from '../../../theme/breakPoints'

export type LabelInList = Pick<Label, 'id' | 'name' | 'description'>

interface Props {
    readonly name: string
    readonly labels: Array<LabelInList>
    readonly validate?: FieldValidator<string[]>
    readonly onChange?: (newValue: string[]) => void
    // A full-width form can afford to lay the checkboxes out in a grid; the
    // narrow label column of the event form keeps the single stacked column.
    readonly columns?: number
}

const columnsStyles = (columns: number) => ({
    [`@media(min-width: ${breakPoints.md}px)`]: {
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        columnGap: 18,
    },
})

const useStyles = createUseStyles({
    checkBox: {
        userSelect: 'none',
    },
    columns2: columnsStyles(2),
    columns3: columnsStyles(3),
})

const FormLabelListField = ({ name, labels, validate, onChange, columns }: Props) => {
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
    const gridClassName = classNames({
        [classes.columns2]: columns === 2,
        [classes.columns3]: columns === 3,
    })

    return (
        <Form.Group className={gridClassName || undefined}>
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
