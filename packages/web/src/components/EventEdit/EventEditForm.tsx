import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import { Form as FinalForm } from 'react-final-form'
import { Col, Row } from 'react-bootstrap'
import { ChevronDown } from 'react-bootstrap-icons'
import GamesAutoCompleteField, { CreateNewGameCallback } from './GamesAutoCompleteField'
import LabelsEditColumn, { LabelFromGql } from '../common/LabelsEditColumn/LabelsEditColumn'
import { fieldValidator, validatePositiveInteger, validateRequired } from '../../utils/validationUtils'
import { useRoutes } from '../../hooks/useRoutes'
import { useFocusInput } from '../../hooks/useFocusInput'
import {
    CreateEventMutation,
    CreateEventMutationVariables,
    UpdateEventMutation,
    UpdateEventMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { formClasses } from '../../utils/formClasses'
import FormTextInputField from '../common/form/FormTextInputField'
import FormRichTextInputField from '../common/form/FormRichTextInputField'
import { createInputFromValues, FormValues, validate } from './formUtils'
import { useShowToast } from '../../hooks/useShowToast'
import BigLoading from '../common/BigLoading/BigLoading'
import SubmitButton from '../common/SubmitButton/SubmitButton'
import FormDateInputField from '../common/form/FormDateInputField'

const createEventGql = require('./graphql/createEvent.graphql')
const updateEventGql = require('./graphql/updateEvent.graphql')

interface Props {
    // Data are still loading - show form
    readonly dataLoading?: boolean
    readonly eventId?: string
    readonly initialValues: FormValues
    readonly hideForm?: boolean
    readonly onCreateNewGame: CreateNewGameCallback
    readonly authorizedRequiredLabels?: LabelFromGql[]
    readonly authorizedOptionalLabels?: LabelFromGql[]
}

const useStyles = createUseStyles(formClasses)

const EventEditForm = ({
    dataLoading,
    eventId,
    initialValues,
    hideForm,
    authorizedRequiredLabels,
    authorizedOptionalLabels,
    onCreateNewGame,
}: Props) => {
    const { t } = useTranslation('common')
    const routes = useRoutes()
    const formRef = useFocusInput<HTMLFormElement>('name')
    const classes = useStyles()
    const showToast = useShowToast()
    const [createEvent, { loading: createLoading }] = useMutation<CreateEventMutation, CreateEventMutationVariables>(
        createEventGql,
    )
    const [updateEvent, { loading: updateLoading }] = useMutation<UpdateEventMutation, UpdateEventMutationVariables>(
        updateEventGql,
    )
    const loading = createLoading || updateLoading
    const [formExpanded, setFormExpanded] = useState(Boolean(eventId)) // Start contracted on new item, expanded one edit

    const handleExpandFields = () => {
        setFormExpanded(true)
    }

    const handleOnSubmit = (values: FormValues) => {
        const input = createInputFromValues(values)
        if (eventId) {
            updateEvent({
                variables: { input: { id: eventId, ...input } },
            }).then(response => {
                const updatedEvent = response?.data?.event.updateEvent
                if (updatedEvent) {
                    showToast(t('EventEdit.eventUpdated'), 'success')
                    routes.push(routes.eventDetail(updatedEvent.id, updatedEvent.name ?? ''))
                }
            })
        } else {
            createEvent({
                variables: { input },
            }).then(response => {
                const createdEvent = response?.data?.event.createEvent
                if (createdEvent) {
                    showToast(t('EventEdit.eventCreated'), 'success')
                    routes.push(routes.eventDetail(createdEvent.id, createdEvent.name ?? ''))
                }
            })
        }
    }

    if (dataLoading) {
        return <BigLoading />
    }

    return (
        <FinalForm id="eventForm" onSubmit={handleOnSubmit} initialValues={initialValues} validate={validate(t)}>
            {({ handleSubmit, submitFailed }) => {
                if (hideForm) {
                    // Hide form
                    return ''
                }

                return (
                    <form onSubmit={handleSubmit} className={classes.form} ref={formRef}>
                        <FormTextInputField
                            name="name"
                            placeholder={t('EventEdit.name')}
                            validate={fieldValidator(t, validateRequired)}
                        />
                        <Row>
                            <Col md={6}>
                                <FormDateInputField name="fromDate" placeholder={t('EventEdit.fromDate')} />
                            </Col>
                            <Col md={6}>
                                <FormDateInputField name="toDate" placeholder={t('EventEdit.toDate')} />
                            </Col>
                        </Row>

                        {!formExpanded && (
                            <>
                                <button type="button" onClick={handleExpandFields} className={classes.expandButton}>
                                    {t('EventEdit.showFields')}
                                    <ChevronDown className={classes.expandArrow} />
                                </button>
                                <SubmitButton submitting={loading}>{t('EventEdit.save')}</SubmitButton>
                                {submitFailed && <span className={classes.formError}>{t('EventEdit.formError')}</span>}
                            </>
                        )}
                        {formExpanded && (
                            <>
                                <header className={classes.subHeader}>{t('EventEdit.additionalFields')}</header>
                                <Row>
                                    <Col md={9}>
                                        <Row>
                                            <Col md={6}>
                                                <FormTextInputField
                                                    name="fromTime"
                                                    placeholder={t('EventEdit.fromTime')}
                                                    hint={t('EventEdit.timeHint')}
                                                />
                                            </Col>
                                            <Col md={6}>
                                                <FormTextInputField
                                                    name="toTime"
                                                    placeholder={t('EventEdit.toTime')}
                                                    hint={t('EventEdit.timeHint')}
                                                />
                                            </Col>
                                        </Row>
                                        <FormTextInputField
                                            name="amountOfPlayers"
                                            placeholder={t('EventEdit.amountOfPlayers')}
                                            validate={fieldValidator(t, validatePositiveInteger)}
                                        />
                                        <FormTextInputField name="web" placeholder={t('EventEdit.web')} />
                                        <FormTextInputField name="loc" placeholder={t('EventEdit.loc')} />
                                        <FormRichTextInputField name="description" hint={t('EventEdit.description')} />
                                        <GamesAutoCompleteField
                                            name="games"
                                            placeholder={t('EventEdit.games')}
                                            hint={t('AutoComplete.startTyping')}
                                            onCreateNew={onCreateNewGame}
                                        />
                                        <SubmitButton submitting={loading}>{t('EventEdit.save')}</SubmitButton>
                                        {submitFailed && (
                                            <span className={classes.formError}>{t('EventEdit.formError')}</span>
                                        )}
                                    </Col>
                                    <Col md={3} className={classes.labelsCol}>
                                        <LabelsEditColumn
                                            authorizedRequiredLabels={authorizedRequiredLabels}
                                            authorizedOptionalLabels={authorizedOptionalLabels}
                                            allowNoRequiredLabel
                                        />
                                    </Col>
                                </Row>
                            </>
                        )}
                    </form>
                )
            }}
        </FinalForm>
    )
}

export default EventEditForm
