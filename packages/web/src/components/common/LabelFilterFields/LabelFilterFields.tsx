import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { formClasses } from '../../../utils/formClasses'
import FormLabelListField, { LabelInList } from '../form/FormLabelListField'

interface Props {
    readonly requiredLabelList: LabelInList[]
    readonly optionalLabelList: LabelInList[]
    readonly onSelectionChanged: (change: { newRequiredLabels?: string[]; newOptionalLabels?: string[] }) => void
}

const useStyles = createUseStyles(formClasses)

const LabelFilterFields = ({ requiredLabelList, optionalLabelList, onSelectionChanged }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const handleRequiredSelectionChanged = (newLabels: string[]) =>
        onSelectionChanged({
            newRequiredLabels: newLabels,
        })

    const handleOptionalSelectionChanged = (newLabels: string[]) =>
        onSelectionChanged({
            newOptionalLabels: newLabels,
        })

    return (
        <>
            <div className={classes.header}>{t('LabelFilterFields.required')}</div>
            <FormLabelListField
                name="requiredLabels"
                labels={requiredLabelList}
                onChange={handleRequiredSelectionChanged}
            />
            <div className={classes.header}>{t('LabelFilterFields.optional')}</div>
            <FormLabelListField
                name="optionalLabels"
                labels={optionalLabelList}
                onChange={handleOptionalSelectionChanged}
            />
        </>
    )
}

export default LabelFilterFields
