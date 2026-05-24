import React from 'react'
import { Form as FinalForm } from 'react-final-form'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import FormTextInputField from '../common/form/FormTextInputField'
import { useFocusInput } from '../../hooks/useFocusInput'
import { fieldValidator, validateRequired } from '../../utils/validationUtils'

export interface GroupAuthor {
    readonly id?: string
    readonly name: string
    readonly itemLabel: string
}

interface Props {
    readonly onHide: () => void
    readonly onAddGroup: (newGroup: GroupAuthor) => void
}

interface FormValues {
    readonly name: string
}

const NewGroupModal = ({ onHide, onAddGroup }: Props) => {
    const handleOnSubmit = ({ name }: FormValues) => onAddGroup({ name, itemLabel: name })
    const { t } = useTranslation('common')
    const formRef = useFocusInput<HTMLFormElement>('name')

    return (
        <Modal show onHide={onHide}>
            <FinalForm<FormValues> onSubmit={handleOnSubmit}>
                {({ handleSubmit }) => (
                    <form onSubmit={handleSubmit} ref={formRef}>
                        <Modal.Header closeButton>
                            <Modal.Title>{t('NewGroupModal.title')}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <FormTextInputField
                                name="name"
                                placeholder={t('NewGroupModal.name')}
                                validate={fieldValidator(t, validateRequired)}
                            />
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="light" onClick={onHide}>
                                {t('NewGroupModal.cancel')}
                            </Button>
                            <Button variant="dark" type="submit">
                                {t('NewGroupModal.save')}
                            </Button>
                        </Modal.Footer>
                    </form>
                )}
            </FinalForm>
        </Modal>
    )
}

export default NewGroupModal
