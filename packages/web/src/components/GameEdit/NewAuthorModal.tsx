import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, Form as BSForm } from 'react-bootstrap'
import { Form as FinalForm } from 'react-final-form'
import { createUseStyles } from 'react-jss'
import { useFocusInput } from '../../hooks/useFocusInput'
import FormTextInputField from '../common/form/FormTextInputField'
import { fieldValidator, validateEmail, validateRequired } from '../../utils/validationUtils'
import { useIsEmailAvailable } from '../../hooks/useIsEmailAvailable'
import SubmitButton from '../common/SubmitButton/SubmitButton'

export interface Author {
    readonly id?: string
    readonly email?: string
    readonly name: string
    readonly nickname?: string
    readonly itemLabel: string
}

interface Props {
    readonly onHide: () => void
    readonly onAddAuthor: (newAuthor: Author) => void
}

export const formatAuthorLabel = ({ name, nickname }: { name: string; nickname?: string | null }) =>
    nickname ? `${nickname} ${name}` : name

interface FormValues {
    email?: string
    name: string
    nickname?: string
}

interface EmailUsedErrorHintProps {
    readonly name: string
    readonly onAdd: () => void
}

const useStyles = createUseStyles({
    errorHint: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
})

const EmailUsedErrorHint = ({ name, onAdd }: EmailUsedErrorHintProps) => {
    const { t } = useTranslation('common')
    const classes = useStyles()

    return (
        <BSForm.Text className={classes.errorHint}>
            {t('NewAuthorModal.emailAlreadyUsed', { name })}
            <Button size="sm" variant="dark" onClick={onAdd}>
                {t('NewAuthorModal.addUser')}
            </Button>
        </BSForm.Text>
    )
}

const NewAuthorModal = ({ onHide, onAddAuthor }: Props) => {
    const { usedByUser, isEmailAvailable } = useIsEmailAvailable()
    const [submitting, setSubmitting] = useState(false)
    const { t } = useTranslation('common')
    const formRef = useFocusInput<HTMLFormElement>('email')

    const handleOnSubmit = async ({ email, name, nickname }: FormValues) => {
        setSubmitting(true)
        if (email) {
            const emailAvailable = await isEmailAvailable(email)
            if (!emailAvailable) {
                // Just return some error - display is done based on usedByName anyway
                setSubmitting(false)
                return { emailAvailable: 'unavailable' }
            }
        }

        onAddAuthor({ email, name, nickname, itemLabel: formatAuthorLabel({ name, nickname }) })
        return undefined
    }

    const handleAddFoundUser = () => {
        if (usedByUser) {
            onAddAuthor({
                ...usedByUser,
                nickname: usedByUser.nickname ?? undefined,
                itemLabel: formatAuthorLabel(usedByUser),
            })
        }
    }

    return (
        <Modal show onHide={onHide}>
            <FinalForm<FormValues> onSubmit={handleOnSubmit}>
                {({ handleSubmit, values }) => {
                    const handleEmailOnBlur = () => {
                        isEmailAvailable(values.email)
                    }

                    return (
                        <form onSubmit={handleSubmit} ref={formRef}>
                            <Modal.Header closeButton>
                                <Modal.Title>{t('NewAuthorModal.title')}</Modal.Title>
                            </Modal.Header>
                            <Modal.Body>
                                <FormTextInputField
                                    name="email"
                                    onBlur={handleEmailOnBlur}
                                    placeholder={t('NewAuthorModal.email')}
                                    hint={t('NewAuthorModal.emailHint')}
                                    validate={fieldValidator(t, validateEmail)}
                                    errorHint={
                                        usedByUser ? (
                                            <EmailUsedErrorHint name={usedByUser.name} onAdd={handleAddFoundUser} />
                                        ) : undefined
                                    }
                                />
                                <FormTextInputField
                                    name="name"
                                    placeholder={t('NewAuthorModal.name')}
                                    validate={fieldValidator(t, validateRequired)}
                                />
                                <FormTextInputField name="nickname" placeholder={t('NewAuthorModal.nickname')} />
                            </Modal.Body>
                            <Modal.Footer>
                                <Button variant="light" onClick={onHide} disabled={submitting}>
                                    {t('NewAuthorModal.cancel')}
                                </Button>
                                <SubmitButton submitting={submitting}>{t('NewAuthorModal.save')}</SubmitButton>
                            </Modal.Footer>
                        </form>
                    )
                }}
            </FinalForm>
        </Modal>
    )
}

export default NewAuthorModal
