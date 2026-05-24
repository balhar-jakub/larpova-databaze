import React, { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import isInBrowser from 'is-in-browser'
import {
    Game,
    LoadEventForEditQuery,
    LoadEventForEditQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import { formClasses } from '../../utils/formClasses'
import { createGameLabel, LinkedGame } from './GamesAutoCompleteField'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { emptyInitialValues, toInitialValues } from './formUtils'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import BigLoading from '../common/BigLoading/BigLoading'

const GameEditForm = React.lazy(() => import('../GameEdit/GameEditForm'))
const EventEditForm = React.lazy(() => import('./EventEditForm'))

const loadEventForEditGql = require('./graphql/loadEventForEdit.graphql')

interface Props {
    readonly eventId?: string
}

const useStyles = createUseStyles({
    ...formClasses,
})

const focusToGames = () => {
    window.setTimeout(() => {
        const element = document.getElementById('games-input')
        element?.focus()
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
}

type TabKey = 'event' | 'game'

const EventEditPanel = ({ eventId }: Props) => {
    const { t } = useTranslation('common')
    const addCallbackRef = useRef<(game: LinkedGame) => void | undefined>()
    const [addingGame, setAddingGame] = useState(false)
    const classes = useStyles()
    const { data } = useQuery<LoadEventForEditQuery, LoadEventForEditQueryVariables>(loadEventForEditGql, {
        variables: {
            eventId: eventId || '',
        },
        fetchPolicy: 'network-only',
        skip: !eventId || !isInBrowser,
    })

    const eventById = data?.eventById
    const initialValues = useMemo(() => (eventById ? toInitialValues(eventById) : undefined), [eventById])
    const ready = !eventId || !!initialValues

    const handleStartCreatingGame = (onAddGame: (game: LinkedGame) => void) => {
        addCallbackRef.current = onAddGame
        setAddingGame(true)
        window.scroll({
            left: 0,
            top: 0,
        })
    }

    const handleCancelCreatingGame = () => {
        addCallbackRef.current = undefined
        setAddingGame(false)
        focusToGames()
    }

    const handleGameCreated = (game: Pick<Game, 'id' | 'name' | 'year'>) => {
        addCallbackRef.current?.({
            id: game.id,
            name: game.name ?? '',
            itemLabel: createGameLabel({ name: game.name, year: game.year ?? undefined }),
        })
        addCallbackRef.current = undefined
        setAddingGame(false)
        focusToGames()
    }

    const tabs = useMemo(() => {
        const res: TabDefinition<TabKey>[] = [
            {
                key: 'event',
                title: t(eventId ? 'EventEdit.editEventTab' : 'EventEdit.addEventTab'),
            },
        ]

        if (addingGame) {
            res.push({
                key: 'game',
                title: t('EventEdit.addGameTab'),
            })
        }

        return res
    }, [addingGame, t, eventId])

    return (
        <>
            <Tabs<TabKey> tabs={tabs} selectedTab={addingGame ? 'game' : 'event'} />
            <div className={classes.row}>
                <React.Suspense fallback={<BigLoading />}>
                    <WidthFixer>
                        <EventEditForm
                            dataLoading={!ready}
                            eventId={eventId}
                            onCreateNewGame={handleStartCreatingGame}
                            hideForm={addingGame}
                            initialValues={initialValues || emptyInitialValues}
                            authorizedOptionalLabels={data?.authorizedOptionalLabels}
                            authorizedRequiredLabels={data?.authorizedRequiredLabels}
                        />
                    </WidthFixer>
                </React.Suspense>
                {addingGame && (
                    <React.Suspense fallback={<BigLoading />}>
                        <WidthFixer>
                            <GameEditForm onGameSaved={handleGameCreated} onFormCanceled={handleCancelCreatingGame} />
                        </WidthFixer>
                    </React.Suspense>
                )}
            </div>
        </>
    )
}

export default EventEditPanel
