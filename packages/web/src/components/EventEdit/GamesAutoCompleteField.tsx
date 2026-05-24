import React from 'react'
import { FieldValidator } from 'final-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@apollo/client'
import { useField } from 'react-final-form'
import {
    AutoCompleteGamesQuery,
    AutoCompleteGamesQueryVariables,
    Game,
} from '../../graphql/__generated__/typescript-operations'
import FormAutoCompleteField from '../common/form/FormAutoCompleteField'
import { useRoutes } from '../../hooks/useRoutes'

const autoCompleteGamesGql = require('./graphql/autoCompleteGames.graphql')

export interface LinkedGame {
    readonly id: string
    readonly name: string
    readonly itemLabel: string
}

export type CreateNewGameCallback = (addGame: (game: LinkedGame) => void) => void

interface Props {
    readonly name: string
    readonly placeholder?: string
    readonly hint?: string
    readonly validate?: FieldValidator<LinkedGame[]>
    readonly onCreateNew: CreateNewGameCallback
}

export const createGameLabel = ({ name, year }: Pick<Game, 'name' | 'year'>) => `${name ?? ''} (${year ?? '?'})`

const GamesAutoCompleteField: React.ForwardRefRenderFunction<HTMLElement, Props> = ({
    name,
    placeholder,
    hint,
    validate,
    onCreateNew,
}: Props) => {
    const { t } = useTranslation('common')
    const routes = useRoutes()
    const { input } = useField(name)
    const { loading, refetch } = useQuery<AutoCompleteGamesQuery, AutoCompleteGamesQueryVariables>(
        autoCompleteGamesGql,
        {
            fetchPolicy: 'cache-and-network',
            skip: true,
        },
    )

    const handleSearch = async (query: string) =>
        refetch({
            query,
            offset: 0,
            limit: 10,
        }).then(data =>
            data.data.games.byQuery.map(game => ({
                ...game,
                name: game.name ?? '',
                itemLabel: createGameLabel(game),
            })),
        )

    const handleCreate = () => {
        onCreateNew((newGame: LinkedGame) => {
            input.onChange([...input.value, newGame])
        })
    }

    return (
        <>
            <FormAutoCompleteField<LinkedGame>
                name={name}
                onCreateNew={handleCreate}
                onSearch={handleSearch}
                placeholder={placeholder}
                hint={hint}
                createUrl={item => routes.gameDetail(item.id, item.name).as}
                createNewText={t('EventEdit.createGame')}
                validate={validate}
                loading={loading}
                entityLinkText={t('EventEdit.gameLink')}
            />
        </>
    )
}

export default GamesAutoCompleteField
