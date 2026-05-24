import React, { useMemo } from 'react'
import { createUseStyles } from 'react-jss'
import { useQuery } from '@apollo/client'
import { useRoutes } from 'src/hooks/useRoutes'
import { useTranslation } from 'react-i18next'
import isInBrowser from 'is-in-browser'
import type { FormValues } from './GameEditForm'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import {
    Game,
    Group,
    Label,
    LoadGameForEditQuery,
    LoadGameForEditQueryVariables,
    Maybe,
    User,
    Video,
} from '../../graphql/__generated__/typescript-operations'
import { formatAuthorLabel } from './NewAuthorModal'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import BigLoading from '../common/BigLoading/BigLoading'

const GameEditForm = React.lazy(() => import('./GameEditForm'))

const loadGameForEditGql = require('./graphql/loadGameForEdit.graphql')

type LoadedGame = Pick<
    Game,
    | 'id'
    | 'name'
    | 'description'
    | 'year'
    | 'players'
    | 'womenRole'
    | 'menRole'
    | 'bothRole'
    | 'hours'
    | 'days'
    | 'web'
    | 'photoAuthor'
    | 'galleryURL'
    | 'ratingsDisabled'
    | 'commentsDisabled'
> & {
    authors: Array<{ __typename?: 'User' } & Pick<User, 'id' | 'name' | 'nickname'>>
    groupAuthor: Array<{ __typename?: 'Group' } & Pick<Group, 'id' | 'name'>>
    video?: Maybe<{ __typename?: 'Video' } & Pick<Video, 'id' | 'path'>>
    labels: Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'isRequired'>>
}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundNearWhite,
        padding: '8px 0',
    },
    body: {
        backgroundColor: darkTheme.backgroundWhite,
    },
})

interface Props {
    readonly gameId?: string
}

const formatInt = (value?: number | null) => (typeof value === 'number' ? value.toString() : undefined)

const toInitialValues = (game: LoadedGame): FormValues => ({
    name: game.name ?? undefined,
    description: game.description ?? undefined,
    authors: game.authors.map(author => ({
        name: author.name,
        nickname: author.nickname ?? undefined,
        id: author.id,
        itemLabel: formatAuthorLabel(author),
    })),
    groupAuthors: game.groupAuthor.map(groupAuthor => ({
        id: groupAuthor.id,
        name: groupAuthor.name ?? '',
        itemLabel: groupAuthor.name ?? '',
    })),
    year: formatInt(game.year),
    players: formatInt(game.players),
    womenRole: formatInt(game.womenRole),
    menRole: formatInt(game.menRole),
    bothRole: formatInt(game.bothRole),
    hours: formatInt(game.hours),
    days: formatInt(game.days),
    web: game.web ?? undefined,
    photoAuthor: game.photoAuthor ?? undefined,
    galleryUrl: game.galleryURL ?? undefined,
    ratingsDisabled: game.ratingsDisabled === true,
    commentsDisabled: game.commentsDisabled === true,
    requiredLabels: game.labels.filter(({ isRequired }) => isRequired).map(({ id }) => id),
    optionalLabels: game.labels.filter(({ isRequired }) => !isRequired).map(({ id }) => id),
    newLabels: [],
})

const GameEditPage = ({ gameId }: Props) => {
    const classes = useStyles()
    const routes = useRoutes()
    const { t } = useTranslation('common')
    const { data } = useQuery<LoadGameForEditQuery, LoadGameForEditQueryVariables>(loadGameForEditGql, {
        variables: {
            gameId: gameId || '',
        },
        fetchPolicy: 'network-only',
        skip: !gameId || !isInBrowser,
    })

    const gameById = data?.gameById
    const initialValues = useMemo(() => (gameById ? toInitialValues(gameById) : undefined), [gameById])
    const ready = !gameId || !!initialValues

    const handleGameSaved = (game: Pick<Game, 'id' | 'name'>) => {
        routes.push(routes.gameDetail(game.id, game.name))
    }

    const tabs = useMemo(
        () => [{ key: 0, title: t(gameId ? 'GameEdit.editGameTab' : 'GameEdit.addGameTab') } as TabDefinition<number>],
        [gameId, t],
    )

    return (
        <>
            <Tabs tabs={tabs} selectedTab={0} />
            <div className={classes.row}>
                <React.Suspense fallback={<BigLoading />}>
                    <WidthFixer className={classes.body}>
                        <GameEditForm
                            gameId={gameId}
                            dataLoading={!ready}
                            onGameSaved={handleGameSaved}
                            initialValues={initialValues}
                            authorizedOptionalLabels={data?.authorizedOptionalLabels}
                            authorizedRequiredLabels={data?.authorizedRequiredLabels}
                        />
                    </WidthFixer>
                </React.Suspense>
            </div>
        </>
    )
}

export default GameEditPage
