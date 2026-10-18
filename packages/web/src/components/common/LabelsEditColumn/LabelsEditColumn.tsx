import React, { useMemo } from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { useTranslation } from 'src/lib/i18n'
import { labelMapper, LabelData, useLoadLabels } from '../../../hooks/usePredefinedLabels'
import { formClasses } from '../../../utils/formClasses'
import { Label } from '../../../graphql/__generated__/typescript-operations'
import FormLabelListField from '../form/FormLabelListField'
import { fieldValidator, validateRequiredArray } from '../../../utils/validationUtils'
import NewLabelsField from '../form/NewLabelsField'

export type LabelFromGql = Pick<Label, 'id' | 'name' | 'description'>

interface Props {
    readonly authorizedOptionalLabels?: LabelFromGql[]
    readonly authorizedRequiredLabels?: LabelFromGql[]
    readonly allowNoRequiredLabel?: boolean
}

const useStyles = createUseStyles(formClasses)

/**
 * Loads the labels the signed-in user may assign (required and optional) plus
 * the existing names a new label must not duplicate. One query covers both
 * lists, so a form that renders the two halves in different places (the game
 * form keeps the required labels with the fields a game cannot be saved
 * without and hides the optional ones behind a disclosure) still asks once.
 */
export const useLabelsForEdit = (
    authorizedRequiredLabels?: LabelFromGql[],
    authorizedOptionalLabels?: LabelFromGql[],
) => {
    const existingRequiredLabels = useMemo(
        () => (authorizedRequiredLabels ? authorizedRequiredLabels.map(labelMapper) : undefined),
        [authorizedRequiredLabels],
    )
    const existingOptionalLabels = useMemo(
        () => (authorizedOptionalLabels ? authorizedOptionalLabels.map(labelMapper) : undefined),
        [authorizedOptionalLabels],
    )

    return useLoadLabels(existingRequiredLabels, existingOptionalLabels)
}

interface RequiredProps {
    readonly labels: LabelData[]
    readonly allowNoRequiredLabel?: boolean
    readonly columns?: number
}

/**
 * The required label checkboxes. A game cannot be saved without at least one of
 * them, so this half never belongs behind a disclosure — hiding it would report
 * "the form contains errors" about a field the visitor cannot see.
 */
export const RequiredLabelsField = ({ labels, allowNoRequiredLabel, columns }: RequiredProps) => {
    const { t } = useTranslation('common')

    return (
        <FormLabelListField
            name="requiredLabels"
            labels={labels}
            columns={columns}
            validate={allowNoRequiredLabel ? undefined : fieldValidator(t, validateRequiredArray)}
        />
    )
}

interface OptionalProps {
    readonly labels: LabelData[]
    readonly existingLabelNames: string[]
    readonly columns?: number
}

/** The optional label checkboxes together with the "new label" proposal field. */
export const OptionalLabelsField = ({ labels, existingLabelNames, columns }: OptionalProps) => (
    <>
        <FormLabelListField name="optionalLabels" labels={labels} columns={columns} />
        <NewLabelsField name="newLabels" existingLabelNames={existingLabelNames} />
    </>
)

/**
 * The label column as the event form renders it: one narrow column carrying the
 * heading, the hint and both halves. The game form composes the exported halves
 * instead, because it lays them out in two different parts of its own page.
 */
const LabelsEditColumn = ({ authorizedOptionalLabels, authorizedRequiredLabels, allowNoRequiredLabel }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const { requiredLabels, optionalLabels, existingLabelNames } = useLabelsForEdit(
        authorizedRequiredLabels,
        authorizedOptionalLabels,
    )

    return (
        <>
            <header className={classNames(classes.header, classes.headerRight)}>{t('LabelsEditColumn.labels')}</header>
            <p className={classes.helpText}>{t('LabelsEditColumn.labelsHint')}</p>
            <header className={classes.subHeader}>{t('LabelsEditColumn.requiredLabels')}</header>
            <RequiredLabelsField labels={requiredLabels} allowNoRequiredLabel={allowNoRequiredLabel} />
            <header className={classes.subHeader}>{t('LabelsEditColumn.optionalLabels')}</header>
            <OptionalLabelsField labels={optionalLabels} existingLabelNames={existingLabelNames} />
        </>
    )
}

export default LabelsEditColumn
