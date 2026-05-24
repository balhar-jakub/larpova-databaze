import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from 'react-bootstrap'
import { EditorState } from 'draft-js'
import { Form as FinalForm } from 'react-final-form'
import { useMutation } from '@apollo/client'
import { editorStateToHtml } from '../common/form/richTextInputUtils'
import FormRichTextInputField from '../common/form/FormRichTextInputField'
import SubmitButton from '../common/SubmitButton/SubmitButton'
import {
    UpdateCommentMutation,
    UpdateCommentMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { useShowToast } from '../../hooks/useShowToast'

const updateCommentGql = require('./graphql/updateComment.graphql')

interface Props {
    readonly gameId: string
    readonly oldText: string
    readonly onHide: () => void
    readonly onLoad: () => void
    readonly onCommentSaved: () => void
}

interface FormValues {
    readonly comment: EditorState | string | undefined
}

const EditCommentModal = ({ gameId, oldText, onHide, onLoad, onCommentSaved }: Props) => {
    const { t } = useTranslation('common')
    const [createOrUpdateComment, { loading }] = useMutation<UpdateCommentMutation, UpdateCommentMutationVariables>(
        updateCommentGql,
    )
    const showToast = useShowToast()

    // Since we are lazy-load, call back (only!) when we are ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(onLoad, [])

    const handleSave = async ({ comment }: FormValues) => {
        const markup = editorStateToHtml(comment) || ''
        const res = await createOrUpdateComment({
            variables: {
                gameId,
                comment: markup,
            },
        })
        if (res.data) {
            // Saved OK
            onCommentSaved()
            showToast(t(oldText ? 'GameDetail.commentUpdated' : 'GameDetail.commentAdded'), 'success')
        }
    }

    const initialValues = useMemo(() => ({ comment: oldText }), [oldText])

    return (
        <FinalForm<FormValues> onSubmit={handleSave} initialValues={initialValues}>
            {({ handleSubmit }) => (
                <Modal show onHide={onHide} size="lg">
                    <form onSubmit={handleSubmit}>
                        <Modal.Header closeButton>
                            <Modal.Title>{t('EditCommentModal.title')}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <FormRichTextInputField name="comment" autoFocus />
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="light" onClick={onHide} disabled={loading}>
                                {t('EditCommentModal.cancel')}
                            </Button>
                            <SubmitButton submitting={loading}>{t('EditCommentModal.save')}</SubmitButton>
                        </Modal.Footer>
                    </form>
                </Modal>
            )}
        </FinalForm>
    )
}

export default EditCommentModal
