import React, { useMemo } from 'react'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { labelMapper, useLoadLabels } from '../../../hooks/usePredefinedLabels'
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

const LabelsEditColumn = ({ authorizedOptionalLabels, authorizedRequiredLabels, allowNoRequiredLabel }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const existingOptionalLabels = useMemo(
        () => (authorizedOptionalLabels ? authorizedOptionalLabels.map(labelMapper) : undefined),
        [authorizedOptionalLabels],
    )
    const existingRequiredLabels = useMemo(
        () => (authorizedRequiredLabels ? authorizedRequiredLabels.map(labelMapper) : undefined),
        [authorizedRequiredLabels],
    )
    const { requiredLabels, optionalLabels, existingLabelNames } = useLoadLabels(
        existingRequiredLabels,
        existingOptionalLabels,
    )

    return (
        <>
            <header className={classNames(classes.header, classes.headerRight)}>{t('LabelsEditColumn.labels')}</header>
            <p className={classes.helpText}>{t('LabelsEditColumn.labelsHint')}</p>
            <header className={classes.subHeader}>{t('LabelsEditColumn.requiredLabels')}</header>
            <FormLabelListField
                name="requiredLabels"
                labels={requiredLabels}
                validate={allowNoRequiredLabel ? undefined : fieldValidator(t, validateRequiredArray)}
            />
            <header className={classes.subHeader}>{t('LabelsEditColumn.optionalLabels')}</header>
            <FormLabelListField name="optionalLabels" labels={optionalLabels} />
            <NewLabelsField name="newLabels" existingLabelNames={existingLabelNames} />
        </>
    )
}

export default LabelsEditColumn
