import React, { useState } from 'react'
import { createUseStyles } from 'react-jss'
import { Form as FinalForm } from 'react-final-form'
import { Button, Col, Row } from 'react-bootstrap'
import { useTranslation } from 'src/lib/i18n'
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
import SeriesAutoCompleteField, { SeriesChoice } from './SeriesAutoCompleteField'
import { seriesChanged } from './seriesChoice'
import AuthorsAutoCompleteField from './AuthorsAutoCompleteField'
import GroupsAutoCompleteField from './GroupsAutoCompleteField'
import { GroupAuthor } from './NewGroupModal'
import { Author } from './NewAuthorModal'
import {
    CreateGameInput,
    CreateGameMutation,
    CreateGameMutationVariables,
    Game,
    SetGameSeriesMutation,
    SetGameSeriesMutationVariables,
    UpdateGameInput,
    UpdateGameMutation,
    UpdateGameMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { editorStateToHtml } from '../common/form/richTextInputUtils'
import { convertFileInput } from '../../utils/graphqlUtils'
import { useFocusInput } from '../../hooks/useFocusInput'
import { formClasses } from '../../utils/formClasses'
import {
    LabelFromGql,
    OptionalLabelsField,
    RequiredLabelsField,
    useLabelsForEdit,
} from '../common/LabelsEditColumn/LabelsEditColumn'
import { IconBack } from '../common/Icons/Icons'
import { useShowToast } from '../../hooks/useShowToast'
import BigLoading from '../common/BigLoading/BigLoading'
import SubmitButton from '../common/SubmitButton/SubmitButton'
import { NewLabel } from '../common/form/NewLabelsField'
import ExpandButton from './ExpandButton'

import * as setGameSeriesDocument from './graphql/setGameSeries.graphql'
import * as createGameDocument from './graphql/createGame.graphql'
import * as updateGameDocument from './graphql/updateGame.graphql'

// The webpack loader exports the document as CommonJS, an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
import type { DocumentNode } from 'graphql'

/** `.graphql` documents arrive as `{ default: DocumentNode }` under the
 * webpack loader and bare under jest — this normalizes both. */
const documentOf = (value: unknown): DocumentNode =>
    ((value as { default?: DocumentNode })?.default ?? value) as DocumentNode
const setGameSeriesGql = documentOf(setGameSeriesDocument)
const createGameGql = documentOf(createGameDocument)
const updateGameGql = documentOf(updateGameDocument)

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
    series?: SeriesChoice | null
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

const useStyles = createUseStyles({
    ...formClasses,
    lead: {
        fontSize: '0.85rem',
        marginBottom: 16,
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20,
    },
    actionsExpand: {
        margin: 0,
    },
    helpBlock: {
        marginBottom: 24,
    },
})

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
 *
 * The form shows what a game cannot be saved without (name, year, authors,
 * description and the required labels) and keeps the rest behind one disclosure,
 * the way the event form already behaves — the data says the remaining fields
 * are used by a minority of games (a photo gallery by 17 %, a video by 8 %) while
 * the form used to open with 56 controls and pushed "Uložit" 2.5 screens down.
 * Editing an existing game opens expanded, so nothing an editor knows to look for
 * hides behind a click; only the two groups almost no game uses (the gallery /
 * video / photo credit trio and the ratings-and-comments switches, 0.8 % of games)
 * stay one level deeper.
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
    const [setGameSeries] = useMutation<SetGameSeriesMutation, SetGameSeriesMutationVariables>(
        setGameSeriesGql,
    )
    const showToast = useShowToast()
    const [formExpanded, setFormExpanded] = useState(Boolean(gameId))
    const [mediaExpanded, setMediaExpanded] = useState(false)
    const [settingsExpanded, setSettingsExpanded] = useState(false)
    const [labelsHelpExpanded, setLabelsHelpExpanded] = useState(false)
    // One query for both label lists (see useLabelsForEdit), because the required
    // half belongs to the always-visible part and the optional half to the section.
    const { requiredLabels, optionalLabels, existingLabelNames } = useLabelsForEdit(
        authorizedRequiredLabels,
        authorizedOptionalLabels,
    )

    /**
     * The series link is a separate mutation (setGameSeries), not a field of
     * CreateGameInput/UpdateGameInput — it has its own permission check and can
     * create the series by name. Called with the saved game's id; a null choice
     * with nothing previously chosen skips the call entirely.
     */
    const syncSeries = (gameId: string, series: SeriesChoice | null | undefined, hadSeries: boolean) => {
        if (!series && !hadSeries) return Promise.resolve()
        return setGameSeries({
            variables: {
                input: {
                    gameId,
                    ...(series?.id ? { seriesId: series.id } : {}),
                    ...(series && !series.id ? { newSeriesName: series.name } : {}),
                    ...(!series ? { seriesId: null } : {}),
                },
            },
        })
    }

    const handleOnSubmit = (data: FormValues) => {
        if (gameId) {
            const input: UpdateGameInput = updateInputFromValues(gameId, data)
            updateGame({ variables: { input } }).then(response => {
                const updatedGame = response.data?.game.updateGame
                if (updatedGame) {
                    // "Added to the series" is only true when the saved game has
                    // one: a removal is a change too, and claiming the game was
                    // added while it was taken out is the same false report this
                    // message replaced.
                    const linked = Boolean(data.series) && seriesChanged(data.series, initialValues?.series)
                    syncSeries(updatedGame.id, data.series, !!initialValues?.series)
                        .then(() => showToast(t(linked ? 'GameEdit.seriesSaved' : 'GameEdit.gameUpdated'), 'success'))
                        // A failed link must not be reported as a saved game: the
                        // rest of the form did save, so say what did not.
                        .catch(() => showToast(t('GameEdit.seriesFailed'), 'alert'))
                        .finally(() => onGameSaved(updatedGame))
                }
            })
        } else {
            const input: CreateGameInput = createInputFromValues(data)
            createGame({ variables: { input } }).then(response => {
                const createdGame = response.data?.game.createGame
                if (createdGame) {
                    syncSeries(createdGame.id, data.series, false)
                        .then(() => showToast(t(data.series ? 'GameEdit.seriesSaved' : 'GameEdit.gameCreated'), 'success'))
                        .catch(() => showToast(t('GameEdit.seriesFailed'), 'alert'))
                        .finally(() => onGameSaved(createdGame))
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
                const submitActions = (
                    <>
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
                    </>
                )

                return (
                    <form onSubmit={handleSubmit} className={classes.form} ref={formRef}>
                        <Row>
                            <Col md={12}>
                                <p className={classes.lead}>{t('GameEdit.formLead')}</p>
                                <FormTextInputField
                                    name="name"
                                    placeholder={t('GameEdit.name')}
                                    validate={fieldValidator(t, validateRequired)}
                                />
                                <Row>
                                    <Col md={6}>
                                        <FormTextInputField
                                            name="year"
                                            placeholder={t('GameEdit.year')}
                                            validate={piValidator}
                                        />
                                    </Col>
                                </Row>
                                <AuthorsAutoCompleteField
                                    name="authors"
                                    placeholder={t('GameEdit.authors')}
                                    hint={t('AutoComplete.startTyping')}
                                    validate={fieldValidator(t, validateRequiredArray)}
                                />
                                <FormRichTextInputField
                                    name="description"
                                    hint={t('GameEdit.description')}
                                    validate={fieldValidator(t, validateRequiredRichText)}
                                />
                                <header className={classes.subHeader}>{t('LabelsEditColumn.requiredLabelsSection')}</header>
                                <RequiredLabelsField labels={requiredLabels} columns={2} />
                                <p className={classes.helpText}>{t('LabelsEditColumn.labelsHint')}</p>
                                {!labelsHelpExpanded && (
                                    <ExpandButton
                                        label={t('GameEdit.labelsHelp')}
                                        onClick={() => setLabelsHelpExpanded(true)}
                                    />
                                )}
                                {labelsHelpExpanded && (
                                    <div className={classes.helpBlock}>
                                        <p className={classes.helpText}>{t('GameEdit.help1')}</p>
                                        <p className={classes.helpText}>{t('GameEdit.help2')}</p>
                                        <p className={classes.helpText}>{t('GameEdit.help3')}</p>
                                        <p className={classes.helpText}>{t('GameEdit.help4')}</p>
                                    </div>
                                )}
                                {!formExpanded && (
                                    <div className={classes.actions}>
                                        <ExpandButton
                                            label={t('GameEdit.showFields')}
                                            onClick={() => setFormExpanded(true)}
                                            className={classes.actionsExpand}
                                        />
                                        {submitActions}
                                    </div>
                                )}
                                {formExpanded && (
                                    <>
                                        <header className={classes.subHeader}>{t('GameEdit.additionalFields')}</header>
                                        <Row>
                                            <Col md={6}>
                                                <GroupsAutoCompleteField
                                                    name="groupAuthors"
                                                    placeholder={t('GameEdit.groups')}
                                                    hint={t('AutoComplete.startTyping')}
                                                />
                                            </Col>
                                            <Col md={6}>
                                                <SeriesAutoCompleteField
                                                    name="series"
                                                    placeholder={t('GameEdit.series')}
                                                    hint={t('GameEdit.seriesHint')}
                                                />
                                            </Col>
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
                                        {!mediaExpanded && (
                                            <ExpandButton
                                                label={t('GameEdit.mediaFields')}
                                                onClick={() => setMediaExpanded(true)}
                                            />
                                        )}
                                        {mediaExpanded && (
                                            <Row>
                                                <Col md={4}>
                                                    <FormTextInputField
                                                        name="photoAuthor"
                                                        placeholder={t('GameEdit.photoAuthor')}
                                                    />
                                                </Col>
                                                <Col md={4}>
                                                    <FormTextInputField
                                                        name="galleryUrl"
                                                        placeholder={t('GameEdit.galleryUrl')}
                                                    />
                                                </Col>
                                                <Col md={4}>
                                                    <FormTextInputField
                                                        name="video"
                                                        placeholder={t('GameEdit.video')}
                                                    />
                                                </Col>
                                            </Row>
                                        )}
                                        <header className={classes.subHeader}>{t('LabelsEditColumn.labels')}</header>
                                        <header className={classes.subHeader}>
                                            {t('LabelsEditColumn.optionalLabelsSection')}
                                        </header>
                                        <OptionalLabelsField
                                            labels={optionalLabels}
                                            existingLabelNames={existingLabelNames}
                                            columns={3}
                                        />
                                        <header className={classes.subHeader}>{t('GameEdit.settingsFields')}</header>
                                        {!settingsExpanded && (
                                            <ExpandButton
                                                label={t('GameEdit.settingsToggle')}
                                                onClick={() => setSettingsExpanded(true)}
                                            />
                                        )}
                                        {settingsExpanded && (
                                            <>
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
                                            </>
                                        )}
                                        <div className={classes.actions}>{submitActions}</div>
                                    </>
                                )}
                            </Col>
                        </Row>
                    </form>
                )
            }}
        </FinalForm>
    )
}

export default GameEditForm
