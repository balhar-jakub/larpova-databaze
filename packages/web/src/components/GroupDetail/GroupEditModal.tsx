import React from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@apollo/client'
import { Form as FinalForm } from 'react-final-form'
import { useFocusInput } from 'src/hooks/useFocusInput'
import { useRoutes } from 'src/hooks/useRoutes'
import {
    CreateGroupMutation,
    CreateGroupMutationVariables,
    UpdateGroupMutation,
    UpdateGroupMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import FormTextInputField from '../common/form/FormTextInputField'
import { fieldValidator, validateRequired } from '../../utils/validationUtils'
import SubmitButton from '../common/SubmitButton/SubmitButton'

const createGroupGql = require('./graphql/createGroup.graphql')
const updateGroupGql = require('./graphql/updateGroup.graphql')

interface Props {
    readonly id?: string
    readonly initialName: string
    readonly onHide: (saved?: boolean) => void
}

interface FormValues {
    name: string
}

const GroupEditModal = ({ id, initialName, onHide }: Props) => {
    const { t } = useTranslation('common')
    const [createMutation, { loading: createLoading }] = useMutation<CreateGroupMutation, CreateGroupMutationVariables>(
        createGroupGql,
    )
    const [updateMutation, { loading: updateLoading }] = useMutation<UpdateGroupMutation, UpdateGroupMutationVariables>(
        updateGroupGql,
    )
    const routes = useRoutes()
    const formRef = useFocusInput<HTMLFormElement>('name')

    const loading = createLoading || updateLoading

    const handleSave = async ({ name }: FormValues) => {
        if (id) {
            const res = await updateMutation({ variables: { input: { id, name } } })
            if (res.data) {
                onHide(true)
            }
        } else {
            await createMutation({ variables: { input: { name } } }).then(res => {
                const newId = res.data?.group.createGroup.id

                if (newId) {
                    routes.push(routes.groupDetail(newId))
                }
            })
        }
    }

    return (
        <FinalForm onSubmit={handleSave} initialValues={{ name: initialName }}>
            {({ handleSubmit }) => (
                <Modal show onHide={onHide}>
                    <form ref={formRef} onSubmit={handleSubmit}>
                        <Modal.Header closeButton>
                            <Modal.Title>
                                {t(id ? 'GroupEditModal.titleEdit' : 'GroupEditModal.titleCreate')}
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <FormTextInputField
                                name="name"
                                placeholder={t('GroupEditModal.name')}
                                validate={fieldValidator(t, validateRequired)}
                            />
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="light" onClick={() => onHide()} disabled={loading}>
                                {t('GroupEditModal.cancel')}
                            </Button>
                            <SubmitButton submitting={loading}>{t('GroupEditModal.save')}</SubmitButton>
                        </Modal.Footer>
                    </form>
                </Modal>
            )}
        </FinalForm>
    )
}

export default GroupEditModal
