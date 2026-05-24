import React, { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import isInBrowser from 'is-in-browser'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import {
    LoadAllLabelsQuery,
    LoadAllLabelsQueryVariables,
    SetLabelRequiredMutation,
    SetLabelRequiredMutationVariables,
    SetLabelAuthorizedMutation,
    SetLabelAuthorizedMutationVariables,
    DeleteLabelMutation,
    DeleteLabelMutationVariables,
    AdminLabelFieldsFragment,
    UpdateLabelMutationVariables,
    UpdateLabelMutation,
} from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import AdminTabs from './AdminTabs'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import BigLoading from '../common/BigLoading/BigLoading'
import { IconEdit, IconTrash } from '../common/Icons/Icons'
import LabelEditModal from '../common/LabelEditmodal/LabelEditModal'
import ConfirmationModal from '../common/ConfirmationModal/ConfirmationModal'
import { breakPoints } from '../../theme/breakPoints'

const loadAllLabelsGql = require('./graphql/loadAllLabels.graphql')
const setLabelRequiredGql = require('./graphql/setLabelRequired.graphql')
const setLabelAuthorizedGql = require('./graphql/setLabelAuthorized.graphql')
const deleteLabelGql = require('./graphql/deleteLabel.graphql')
const updateLabelGql = require('./graphql/updateLabel.graphql')

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0',
        fontSize: '0.85rem',
    },
    labelRow: {
        backgroundColor: darkTheme.backgroundRealWhite,
        display: 'flex',
        alignItems: 'center',
        margin: '4px 0',
        padding: '4px 20px',
        flexDirection: 'column',
    },
    loading: {
        opacity: 0.5,
    },
    name: {
        flexBasis: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexShrink: 0,
        fontSize: '1.75rem',
    },
    description: {
        flexGrow: 1,
        flexBasis: '100%',
        margin: '4px 8px 10px',
    },
    controls: {
        flexShrink: 0,
        paddingBottom: 10,
        zoom: 0.75,
    },
    buttonSpace: {
        marginLeft: 4,
    },
    [`@media(min-width: ${breakPoints.sm}px)`]: {
        controls: {
            zoom: 1,
        },
    },
    [`@media(min-width: ${breakPoints.lg}px)`]: {
        name: {
            fontSize: '1rem',
            flexBasis: 200,
        },
        labelRow: {
            flexDirection: 'row',
        },
        description: {
            flexBasis: 0,
            margin: '0 8px',
        },
        controls: {
            paddingBottom: 0,
        },
    },
})

const sortLabels = (labels: AdminLabelFieldsFragment[]) =>
    [...labels].sort((a, b) => {
        if (a.isAuthorized && !b.isAuthorized) {
            return -1
        }
        if (!a.isAuthorized && b.isAuthorized) {
            return 1
        }
        if (a.isRequired && !b.isRequired) {
            return -1
        }
        if (!a.isRequired && b.isRequired) {
            return 1
        }

        const nameA = (a.name ?? '').toLocaleLowerCase()
        const nameB = (b.name ?? '').toLocaleLowerCase()
        if (nameA < nameB) {
            return -1
        }
        if (nameA > nameB) {
            return 1
        }

        return parseInt(a.id, 10) - parseInt(b.id, 10)
    })

const AdminLabelsPanel = () => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [editingLabel, setEditingLabel] = useState<AdminLabelFieldsFragment | undefined>()
    const [toDeleteLabelId, setToDeleteLabelId] = useState('')
    const existingLabelNamesRef = useRef<string[]>([])

    const { data, loading, refetch } = useQuery<LoadAllLabelsQuery, LoadAllLabelsQueryVariables>(loadAllLabelsGql, {
        skip: !isInBrowser,
        fetchPolicy: 'cache-and-network',
    })

    const [setLabelRequiredMutation, { loading: setRequiredLoading }] = useMutation<
        SetLabelRequiredMutation,
        SetLabelRequiredMutationVariables
    >(setLabelRequiredGql)
    const [setLabelAuthorizedMutation, { loading: setAuthorizedLoading }] = useMutation<
        SetLabelAuthorizedMutation,
        SetLabelAuthorizedMutationVariables
    >(setLabelAuthorizedGql)
    const [deleteLabelMutation, { loading: deleteLoading }] = useMutation<
        DeleteLabelMutation,
        DeleteLabelMutationVariables
    >(deleteLabelGql)
    const [updateLabelMutation, { loading: updateLoading }] = useMutation<
        UpdateLabelMutation,
        UpdateLabelMutationVariables
    >(updateLabelGql)

    const allLabels = data?.admin.allLabels
    const sortedLabels = useMemo(() => sortLabels(allLabels || []), [allLabels])
    const isLoading = loading || setRequiredLoading || setAuthorizedLoading || deleteLoading || updateLoading

    const hideDialogs = () => {
        setEditingLabel(undefined)
        setToDeleteLabelId('')
    }

    const handleEditLabel = (label: AdminLabelFieldsFragment) => () => {
        existingLabelNamesRef.current = sortedLabels.filter(({ id }) => id !== label.id).map(({ name }) => name ?? '')
        setEditingLabel(label)
    }

    const handleToggleLabelAuthorized = (label: AdminLabelFieldsFragment) => () => {
        setLabelAuthorizedMutation({
            variables: {
                labelId: label.id,
                authorized: !label.isAuthorized,
            },
        })
    }

    const handleToggleLabelRequired = (label: AdminLabelFieldsFragment) => () => {
        setLabelRequiredMutation({
            variables: {
                labelId: label.id,
                required: !label.isRequired,
            },
        })
    }

    const handleDeleteLabel = (label: AdminLabelFieldsFragment) => () => {
        setToDeleteLabelId(label.id)
    }

    const handleDeleteLabelConfirmed = () => {
        deleteLabelMutation({
            variables: {
                labelId: toDeleteLabelId,
            },
        }).then(res => {
            if (res.data) {
                hideDialogs()
                refetch()
            }
        })
    }

    const handleSaveLabel = async ({ name, description }: { name: string; description?: string | undefined }) => {
        const res = await updateLabelMutation({
            variables: {
                input: {
                    id: editingLabel?.id || '',
                    name,
                    description,
                },
            },
        })
        if (res.data) {
            refetch()
            hideDialogs()
        }
    }

    return (
        <>
            <AdminTabs selectedTab="labels" />

            <div className={classes.row}>
                {sortedLabels.length === 0 && <BigLoading />}
                <WidthFixer className={isLoading && sortedLabels.length > 0 ? classes.loading : undefined}>
                    {sortedLabels.map(label => (
                        <div className={classes.labelRow} key={label.id}>
                            <div className={classes.name}>{label.name}</div>
                            <div className={classes.description}>{label.description}</div>
                            <div className={classes.controls}>
                                <Button variant="dark" onClick={handleEditLabel(label)}>
                                    <IconEdit />
                                </Button>
                                <Button
                                    className={classes.buttonSpace}
                                    variant={label.isAuthorized ? 'success' : 'dark'}
                                    onClick={handleToggleLabelAuthorized(label)}
                                >
                                    {t('AdminLabels.authorized')}
                                </Button>
                                <Button
                                    className={classes.buttonSpace}
                                    variant={label.isRequired ? 'danger' : 'dark'}
                                    onClick={handleToggleLabelRequired(label)}
                                >
                                    {t('AdminLabels.required')}
                                </Button>
                                <Button
                                    className={classes.buttonSpace}
                                    variant="dark"
                                    onClick={handleDeleteLabel(label)}
                                >
                                    <IconTrash />
                                </Button>
                            </div>
                        </div>
                    ))}
                </WidthFixer>
            </div>
            {editingLabel && (
                <LabelEditModal
                    titleKey="LabelEditModal.titleEdit"
                    existingNewLabels={[]}
                    existingLabelNames={existingLabelNamesRef.current}
                    initialValues={{ name: editingLabel.name ?? '', description: editingLabel.description ?? '' }}
                    submitting={updateLoading}
                    onHide={hideDialogs}
                    onCreateLabel={handleSaveLabel}
                />
            )}
            {toDeleteLabelId && (
                <ConfirmationModal
                    show
                    content={t('AdminLabels.deleteConfirm')}
                    onHide={hideDialogs}
                    onCancel={hideDialogs}
                    onConfirm={handleDeleteLabelConfirmed}
                />
            )}
        </>
    )
}

export default AdminLabelsPanel
