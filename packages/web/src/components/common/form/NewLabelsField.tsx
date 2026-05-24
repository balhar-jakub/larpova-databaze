import React, { useState } from 'react'
import { useField } from 'react-final-form'
import { Button, Form } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import FormCheckLabelWithTooltip from './FormCheckLabelWithTooltip'
import LabelEditModal from '../LabelEditmodal/LabelEditModal'

export interface NewLabel {
    readonly name: string
    readonly description?: string
}

interface Props {
    readonly name: string
    readonly existingLabelNames: string[]
}

const NewLabelsField = ({ name: fieldName, existingLabelNames }: Props) => {
    const {
        input: { value, onChange },
    } = useField<NewLabel[]>(fieldName)
    const { t } = useTranslation('common')
    const [modalShown, setModalShown] = useState(false)

    const handleRemoveLabel = (nameToRemove: string) => () => {
        onChange({ target: { value: value.filter(label => label.name !== nameToRemove) } })
    }

    const hideModal = () => setModalShown(false)

    const showModal = () => setModalShown(true)

    const handleCreateLabel = ({ name, description }: { name: string; description?: string }) => {
        onChange({ target: { value: [...value, { name, description }] } })
        setModalShown(false)
    }

    return (
        <>
            <Form.Group>
                {value.map(label => (
                    <Form.Check
                        key={label.name}
                        type={'checkbox' as any}
                        label={
                            /* eslint-disable-next-line react/jsx-wrap-multilines */
                            <FormCheckLabelWithTooltip
                                label={label.name}
                                tooltip={label.description}
                                tooltipId={label.name}
                            />
                        }
                        checked
                        onChange={handleRemoveLabel(label.name)}
                    />
                ))}
            </Form.Group>
            <Button variant="dark" onClick={showModal}>
                {t('NewLabelsField.newLabel')}
            </Button>
            {modalShown && (
                <LabelEditModal
                    titleKey="LabelEditModal.title"
                    existingNewLabels={value}
                    existingLabelNames={existingLabelNames}
                    onHide={hideModal}
                    onCreateLabel={handleCreateLabel}
                />
            )}
        </>
    )
}

export default NewLabelsField
