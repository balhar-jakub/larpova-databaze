import React from 'react'
import { Button, Modal } from 'react-bootstrap'
import { Form as FinalForm } from 'react-final-form'
import { useTranslation } from 'react-i18next'
import { useFocusInput } from '../../../hooks/useFocusInput'
import { fieldValidator, validateRequired } from '../../../utils/validationUtils'
import SubmitButton from '../SubmitButton/SubmitButton'
import FormTextInputField from '../form/FormTextInputField'

interface Props {
    readonly titleKey: string
    readonly existingNewLabels: Array<{ name: string }>
    readonly existingLabelNames: string[]
    readonly submitting?: boolean
    readonly initialValues?: FormValues
    readonly onHide: () => void
    readonly onCreateLabel: (label: FormValues) => void
}

interface FormValues {
    name: string
    description?: string
}

const LabelEditModal = ({
    titleKey,
    existingNewLabels,
    existingLabelNames,
    submitting = false,
    initialValues,
    onHide,
    onCreateLabel,
}: Props) => {
    const formRef = useFocusInput<HTMLFormElement>('name')
    const { t } = useTranslation('common')

    const validate = ({ name }: FormValues) => {
        const error = validateRequired(name)
        if (error) {
            return { name: t(error) }
        }

        if (existingLabelNames.find(labelName => labelName.localeCompare(name) === 0)) {
            return { name: t('LabelEditModal.labelExists') }
        }

        if (existingNewLabels.find(existingLabel => existingLabel.name.localeCompare(name) === 0)) {
            return { name: t('LabelEditModal.labelExists') }
        }

        return undefined
    }

    return (
        <Modal show onHide={onHide}>
            <FinalForm<FormValues> onSubmit={onCreateLabel} validate={validate} initialValues={initialValues}>
                {({ handleSubmit }) => (
                    <form onSubmit={handleSubmit} ref={formRef}>
                        <Modal.Header closeButton>
                            <Modal.Title>{t(titleKey)}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <FormTextInputField
                                name="name"
                                placeholder={t('LabelEditModal.name')}
                                validate={fieldValidator(t, validateRequired)}
                            />
                            <FormTextInputField name="description" placeholder={t('LabelEditModal.description')} />
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="light" onClick={onHide}>
                                {t('LabelEditModal.cancel')}
                            </Button>
                            <SubmitButton submitting={submitting}>{t('LabelEditModal.save')}</SubmitButton>
                        </Modal.Footer>
                    </form>
                )}
            </FinalForm>
        </Modal>
    )
}

export default LabelEditModal
