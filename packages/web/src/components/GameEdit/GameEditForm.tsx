import React from 'react'
import { createUseStyles } from 'react-jss'
import { Form as FinalForm } from 'react-final-form'
import { Button, Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@apollo/client'
import FormTextInputField from '../common/form/FormTextInputField'
import FormRichTextInputField, { RichTextFieldValue } from '../common/form/FormRichTextInputField'
import {
    fieldValidator,
    validatePositiveInteger,
    validateRequired,
    validateRequiredArray,
    validateRequiredRichText,
} from '../../utils/validationUtils'
import FormFileInputField from '../common/form/FormFileInputField'
import FormCheckBoxField from '../common/form/FormCheckBoxField'
import AuthorsAutoCompleteField from './AuthorsAutoCompleteField'
import GroupsAutoCompleteField from './GroupsAutoCompleteField'
import { GroupAuthor } from './NewGroupModal'
import { Author } from './NewAuthorModal'
import {
    CreateGameInput,
    CreateGameMutation,
    CreateGameMutationVariables,
    Game,
    UpdateGameInput,
    UpdateGameMutation,
    UpdateGameMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { editorStateToHtml } from '../common/form/richTextInputUtils'
import { convertFileInput } from '../../utils/graphqlUtils'
import { useFocusInput } from '../../hooks/useFocusInput'
import { formClasses } from '../../utils/formClasses'
import LabelsEditColumn, { LabelFromGql } from '../common/LabelsEditColumn/LabelsEditColumn'
import { IconBack } from '../common/Icons/Icons'
import { useShowToast } from '../../hooks/useShowToast'
import BigLoading from '../common/BigLoading/BigLoading'
import SubmitButton from '../common/SubmitButton/SubmitButton'
import { NewLabel } from '../common/form/NewLabelsField'

const createGameGql = require('./graphql/createGame.graphql')
const updateGameGql = require('./graphql/updateGame.graphql')

export interface FormValues {
    name?: string
    description?: RichTextFieldValue
    authors: Author[]
    groupAuthors: GroupAuthor[]
    year?: string
    players?: string
    womenRole?: string
    menRole?: string
    bothRole?: string
    hours?: string
    days?: string
    coverImage?: string
    web?: string
    photoAuthor?: string
    galleryUrl?: string
    video?: string
    ratingsDisabled?: boolean
    commentsDisabled?: boolean
    requiredLabels: string[]
    optionalLabels: string[]
    newLabels: NewLabel[]
}

interface Props {
    // When called with dataLoading = true, shows big loading indicator instead of the form
    readonly dataLoading?: boolean
    readonly gameId?: string
    readonly initialValues?: FormValues
    readonly authorizedRequiredLabels?: LabelFromGql[]
    readonly authorizedOptionalLabels?: LabelFromGql[]
    readonly onGameSaved: (game: Pick<Game, 'id' | 'name' | 'year'>) => void
    readonly onFormCanceled?: () => void
}

const emptyInitialValues: FormValues = {
    authors: [],
    groupAuthors: [],
    requiredLabels: [],
    optionalLabels: [],
    newLabels: [],
}

const useStyles = createUseStyles(formClasses)

const convertInt = (input?: string) => (input ? parseInt(input, 10) : undefined)

const createInputFromValues = (data: FormValues): CreateGameInput => ({
    name: data.name || '',
    description: editorStateToHtml(data.description) || '',
    authors: data.authors.map(({ id }) => id).filter(id => !!id) as string[],
    newAuthors: data.authors.filter(({ id }) => !id).map(({ email, name, nickname }) => ({ email, name, nickname })),
    groupAuthors: data.groupAuthors.map(({ id }) => id).filter(id => !!id) as string[],
    newGroupAuthors: data.groupAuthors.filter(({ id }) => !id).map(({ name }) => ({ name })),
    labels: [...data.requiredLabels, ...data.optionalLabels],
    newLabels: data.newLabels,
    year: convertInt(data.year),
    players: convertInt(data.players),
    menRole: convertInt(data.menRole),
    womenRole: convertInt(data.womenRole),
    bothRole: convertInt(data.bothRole),
    hours: convertInt(data.hours),
    days: convertInt(data.days),
    coverImage: convertFileInput(data.coverImage),
    web: data.web,
    photoAuthor: data.photoAuthor,
    galleryURL: data.galleryUrl,
    video: data.video,
    ratingsDisabled: data.ratingsDisabled,
    commentsDisabled: data.commentsDisabled,
})

const updateInputFromValues = (gameId: string, data: FormValues): UpdateGameInput => ({
    id: gameId,
    ...createInputFromValues(data),
})

/**
 * Contains inner form, calls callback after game is created (or updated)
 */
const GameEditForm = ({
    dataLoading,
    gameId,
    initialValues,
    authorizedOptionalLabels,
    authorizedRequiredLabels,
    onGameSaved,
    onFormCanceled,
}: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const formRef = useFocusInput<HTMLFormElement>('name')
    const [createGame, { loading: createGameLoading }] = useMutation<CreateGameMutation, CreateGameMutationVariables>(
        createGameGql,
    )
    const [updateGame, { loading: updateGameLoading }] = useMutation<UpdateGameMutation, UpdateGameMutationVariables>(
        updateGameGql,
    )
    const showToast = useShowToast()

    const handleOnSubmit = (data: FormValues) => {
        if (gameId) {
            const input: UpdateGameInput = updateInputFromValues(gameId, data)
            updateGame({ variables: { input } }).then(response => {
                const updatedGame = response.data?.game.updateGame
                if (updatedGame) {
                    showToast(t('GameEdit.gameUpdated'), 'success')
                    onGameSaved(updatedGame)
                }
            })
        } else {
            const input: CreateGameInput = createInputFromValues(data)
            createGame({ variables: { input } }).then(response => {
                const createdGame = response.data?.game.createGame
                if (createdGame) {
                    showToast(t('GameEdit.gameCreated'), 'success')
                    onGameSaved(createdGame)
                }
            })
        }
    }

    const loading = createGameLoading || updateGameLoading

    const piValidator = fieldValidator(t, validatePositiveInteger)

    if (dataLoading) {
        return <BigLoading />
    }

    return (
        <FinalForm onSubmit={handleOnSubmit} initialValues={initialValues || emptyInitialValues} id="gameForm">
            {({ handleSubmit, submitFailed }) => {
                return (
                    <form onSubmit={handleSubmit} className={classes.form} ref={formRef}>
                        <Row>
                            <Col md={9}>
                                <header className={classes.header}>{t('GameEdit.help')}</header>
                                <div>
                                    <p className={classes.helpText}>{t('GameEdit.help1')}</p>
                                    <p className={classes.helpText}>{t('GameEdit.help2')}</p>
                                    <p className={classes.helpText}>{t('GameEdit.help3')}</p>
                                    <p className={classes.helpText}>{t('GameEdit.help4')}</p>
                                </div>
                                <header className={classes.header}>{t('GameEdit.gameFields')}</header>
                                <header className={classes.subHeader}>{t('GameEdit.requiredFields')}</header>
                                <FormTextInputField
                                    name="name"
                                    placeholder={t('GameEdit.name')}
                                    validate={fieldValidator(t, validateRequired)}
                                />
                                <FormRichTextInputField
                                    name="description"
                                    hint={t('GameEdit.description')}
                                    validate={fieldValidator(t, validateRequiredRichText)}
                                />
                                <header className={classes.subHeader}>{t('GameEdit.additionalFields')}</header>
                                <Row>
                                    <Col md={6}>
                                        <AuthorsAutoCompleteField
                                            name="authors"
                                            placeholder={t('GameEdit.authors')}
                                            hint={t('AutoComplete.startTyping')}
                                            validate={fieldValidator(t, validateRequiredArray)}
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <GroupsAutoCompleteField
                                            name="groupAuthors"
                                            placeholder={t('GameEdit.groups')}
                                            hint={t('AutoComplete.startTyping')}
                                        />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6}>
                                        <FormTextInputField
                                            name="year"
                                            placeholder={t('GameEdit.year')}
                                            validate={piValidator}
                                        />
                                    </Col>
                                    <Col md={6} />
                                </Row>
                                <Row>
                                    <Col md={3}>
                                        <FormTextInputField
                                            name="players"
                                            placeholder={t('GameEdit.players')}
                                            validate={piValidator}
                                        />
                                    </Col>
                                    <Col md={3}>
                                        <FormTextInputField
                                            name="womenRole"
                                            placeholder={t('GameEdit.womenRole')}
                                            validate={piValidator}
                                        />
                                    </Col>
                                    <Col md={3}>
                                        <FormTextInputField
                                            name="menRole"
                                            placeholder={t('GameEdit.menRole')}
                                            validate={piValidator}
                                        />
                                    </Col>
                                    <Col md={3}>
                                        <FormTextInputField
                                            name="bothRole"
                                            placeholder={t('GameEdit.bothRole')}
                                            validate={piValidator}
                                        />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6}>
                                        <FormTextInputField
                                            name="hours"
                                            placeholder={t('GameEdit.hours')}
                                            validate={piValidator}
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <FormTextInputField
                                            name="days"
                                            placeholder={t('GameEdit.days')}
                                            validate={piValidator}
                                        />
                                    </Col>
                                </Row>
                                <header className={classes.subHeader}>{t('GameEdit.presentationFields')}</header>
                                <Row>
                                    <Col md={6}>
                                        <FormFileInputField
                                            name="coverImage"
                                            placeholder={t('GameEdit.coverImage')}
                                            hint={t('GameEdit.coverImageHint')}
                                            sizeLimit={2000000}
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <FormTextInputField name="web" placeholder={t('GameEdit.web')} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={4}>
                                        <FormTextInputField
                                            name="photoAuthor"
                                            placeholder={t('GameEdit.photoAuthor')}
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <FormTextInputField name="galleryUrl" placeholder={t('GameEdit.galleryUrl')} />
                                    </Col>
                                    <Col md={4}>
                                        <FormTextInputField name="video" placeholder={t('GameEdit.video')} />
                                    </Col>
                                </Row>
                                <header className={classes.subHeader}>{t('GameEdit.settingsFields')}</header>
                                <FormCheckBoxField
                                    name="ratingsDisabled"
                                    label={t('GameEdit.ratingsDisabled')}
                                    hint={t('GameEdit.ratingsDisabledHint')}
                                />
                                <FormCheckBoxField
                                    name="commentsDisabled"
                                    label={t('GameEdit.commentsDisabled')}
                                    hint={t('GameEdit.commentsDisabledHint')}
                                />
                                {onFormCanceled && (
                                    <Button
                                        variant="light"
                                        disabled={loading}
                                        onClick={onFormCanceled}
                                        className={classes.cancelButton}
                                    >
                                        <IconBack />
                                        &nbsp;
                                        {t('GameEdit.back')}
                                    </Button>
                                )}
                                <SubmitButton submitting={loading}>{t('GameEdit.save')}</SubmitButton>
                                {submitFailed && <span className={classes.formError}>{t('GameEdit.formError')}</span>}
                            </Col>
                            <Col md={3} className={classes.labelsCol}>
                                <LabelsEditColumn
                                    authorizedOptionalLabels={authorizedOptionalLabels}
                                    authorizedRequiredLabels={authorizedRequiredLabels}
                                />
                            </Col>
                        </Row>
                    </form>
                )
            }}
        </FinalForm>
    )
}

export default GameEditForm
