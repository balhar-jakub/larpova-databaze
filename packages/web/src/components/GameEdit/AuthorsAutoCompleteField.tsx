import React, { useState } from 'react'
import { FieldValidator } from 'final-form'
import { useQuery } from '@apollo/client'
import { SearchAuthorsQuery, SearchAuthorsQueryVariables } from 'src/graphql/__generated__/typescript-operations'
import { useTranslation } from 'react-i18next'
import { useField } from 'react-final-form'
import FormAutoCompleteField from '../common/form/FormAutoCompleteField'
import NewAuthorModal, { Author, formatAuthorLabel } from './NewAuthorModal'
import { useRoutes } from '../../hooks/useRoutes'

const searchAuthorsGql = require('./graphql/searchAuthors.graphql')

interface Props {
    readonly name: string
    readonly placeholder?: string
    readonly hint?: string
    readonly validate?: FieldValidator<Author[]>
}

const AuthorsAutoCompleteField = ({ name, placeholder, hint, validate }: Props) => {
    const { t } = useTranslation('common')
    const [showModal, setShowModal] = useState(false)
    const { input } = useField(name)
    const routes = useRoutes()
    const { loading, refetch } = useQuery<SearchAuthorsQuery, SearchAuthorsQueryVariables>(searchAuthorsGql, {
        fetchPolicy: 'cache-and-network',
        skip: true,
    })

    const handleSearch = async (query: string) =>
        refetch({
            query,
            offset: 0,
            limit: 7,
        }).then(data =>
            data.data.usersByQuery.map(user => ({
                ...user,
                itemLabel: formatAuthorLabel(user),
                nickname: user.nickname ?? undefined,
            })),
        )

    const handleCreate = () => {
        setShowModal(true)
    }

    const handleHide = () => {
        setShowModal(false)
    }

    const handleAddAuthor = (newAuthor: Author) => {
        input.onChange({ target: { value: [...input.value, newAuthor] } })
        setShowModal(false)
    }

    return (
        <>
            <FormAutoCompleteField<Author>
                name={name}
                onCreateNew={handleCreate}
                onSearch={handleSearch}
                placeholder={placeholder}
                hint={hint}
                createUrl={(item: Author) => routes.userProfile(item.id || '').as}
                createNewText={t('GameEdit.createAuthor')}
                validate={validate}
                loading={loading}
                entityLinkText={t('GameEdit.profileLink')}
            />
            {showModal && <NewAuthorModal onHide={handleHide} onAddAuthor={handleAddAuthor} />}
        </>
    )
}

export default AuthorsAutoCompleteField
