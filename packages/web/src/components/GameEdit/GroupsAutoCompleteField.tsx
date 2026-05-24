import React, { useState } from 'react'
import { FieldValidator } from 'final-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@apollo/client'
import { useField } from 'react-final-form'
import { SearchGroupsQuery, SearchGroupsQueryVariables } from '../../graphql/__generated__/typescript-operations'
import FormAutoCompleteField from '../common/form/FormAutoCompleteField'
import NewGroupModal, { GroupAuthor } from './NewGroupModal'
import { useRoutes } from '../../hooks/useRoutes'

const searchGroupsGql = require('./graphql/searchGroups.graphql')

interface Props {
    readonly name: string
    readonly placeholder?: string
    readonly hint?: string
    readonly validate?: FieldValidator<GroupAuthor[]>
}

const GroupsAutoCompleteField = ({ name, placeholder, hint, validate }: Props) => {
    const { t } = useTranslation('common')
    const [showModal, setShowModal] = useState(false)
    const { input } = useField(name)
    const routes = useRoutes()
    const { loading, refetch } = useQuery<SearchGroupsQuery, SearchGroupsQueryVariables>(searchGroupsGql, {
        fetchPolicy: 'cache-and-network',
        skip: true,
    })

    const handleSearch = async (query: string) =>
        refetch({
            query,
            offset: 0,
            limit: 7,
        }).then(data =>
            data.data.groupsByQuery.map(group => ({
                ...group,
                name: group.name || '',
                itemLabel: group.name || '',
            })),
        )

    const handleCreate = () => {
        setShowModal(true)
    }

    const handleHide = () => {
        setShowModal(false)
    }

    const handleAddGroup = (newGroup: GroupAuthor) => {
        input.onChange({ target: { value: [...input.value, newGroup] } })
        setShowModal(false)
    }

    return (
        <>
            <FormAutoCompleteField<GroupAuthor>
                name={name}
                onCreateNew={handleCreate}
                onSearch={handleSearch}
                placeholder={placeholder}
                hint={hint}
                createUrl={(item: GroupAuthor) => routes.groupDetail(item.id || '').as}
                createNewText={t('GameEdit.createGroup')}
                validate={validate}
                loading={loading}
                entityLinkText={t('GameEdit.groupLink')}
            />
            {showModal && <NewGroupModal onHide={handleHide} onAddGroup={handleAddGroup} />}
        </>
    )
}

export default GroupsAutoCompleteField
