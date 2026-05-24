import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, ModalProps } from 'react-bootstrap'

interface Props extends Pick<ModalProps, 'size' | 'show'> {
    readonly title?: React.ReactNode
    readonly content: React.ReactNode
    readonly cancelButtonText?: React.ReactNode
    readonly confirmButtonText?: React.ReactNode
    readonly loading?: boolean
    readonly onHide: () => void
    readonly onCancel: () => void
    readonly onConfirm: () => void
}

const ConfirmationModal = ({
    show,
    size,
    content,
    title,
    cancelButtonText,
    confirmButtonText,
    loading,
    onHide,
    onCancel,
    onConfirm,
}: Props) => {
    const { t } = useTranslation('common')

    return (
        <Modal show={show} onHide={onHide} size={size}>
            <Modal.Header closeButton>
                <Modal.Title>{title || t('ConfirmationModal.title')}</Modal.Title>
            </Modal.Header>
            <Modal.Body>{content}</Modal.Body>
            <Modal.Footer>
                <Button variant="light" onClick={onCancel} disabled={loading}>
                    {cancelButtonText || t('ConfirmationModal.cancel')}
                </Button>
                <Button variant="dark" onClick={onConfirm} disabled={loading}>
                    {confirmButtonText || t('ConfirmationModal.confirm')}
                </Button>
            </Modal.Footer>
        </Modal>
    )
}

export default ConfirmationModal
