import React, { useMemo, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useApolloClient, useQuery } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import { Form as FinalForm } from 'react-final-form'
import classNames from 'classnames'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import {
    LadderGameDataFragment,
    LadderInitialGamesQuery,
    LadderInitialGamesQueryVariables,
    LadderMoreGamesQuery,
    LadderMoreGamesQueryVariables,
    LadderType,
} from '../../graphql/__generated__/typescript-operations'
import LadderGamePanel from './LadderGamePanel'
import { darkTheme } from '../../theme/darkTheme'
import { labelMapper } from '../../hooks/usePredefinedLabels'
import LabelFilterFields from '../common/LabelFilterFields/LabelFilterFields'
import Pager from '../common/Pager/Pager'
import { useRoutes } from '../../hooks/useRoutes'
import { LabelFromGql } from '../common/LabelsEditColumn/LabelsEditColumn'
import BigLoading from '../common/BigLoading/BigLoading'
import { breakPoints } from '../../theme/breakPoints'

const ladderInitialGames = require('./graphql/ladderInitialGames.graphql')
const ladderMoreGames = require('./graphql/ladderMoreGames.graphql')

interface Props {
    readonly ladderType: LadderType
    readonly initialRequiredLabelIds?: string[]
    readonly initialOptionalLabelIds?: string[]
}

interface FormValues {
    requiredLabels: string[]
    optionalLabels: string[]
}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
    },
    widthFixer: {
        paddingTop: 20,
        paddingBottom: 20,
    },
    loading: {
        opacity: 0.5,
    },
    labelsCol: {
        padding: '0 15px',
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        labelsCol: {
            padding: '0 30px',
            marginTop: 16,
            marginBottom: 16,
        },
    },
})

const PAGE_SIZE = 25

type Page = Partial<{
    games: LadderGameDataFragment[]
    totalAmount: number
}>

const tabs: Array<TabDefinition<LadderType>> = [
    {
        key: LadderType.RecentAndMostPlayed,
        title: { key: 'Ladder.recentAndMostPlayedTab' },
    },
    {
        key: LadderType.Recent,
        title: { key: 'Ladder.recent' },
    },
    {
        key: LadderType.Best,
        title: { key: 'Ladder.best' },
    },
    {
        key: LadderType.MostPlayed,
        title: { key: 'Ladder.mostPlayed' },
    },
    {
        key: LadderType.MostCommented,
        title: { key: 'Ladder.mostCommented' },
    },
]

const LadderPanel = ({ ladderType, initialRequiredLabelIds, initialOptionalLabelIds }: Props) => {
    const [offset, setOffset] = useState(0)
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState<Page>({})
    const [requiredLabels, setRequiredLabels] = useState<LabelFromGql[] | undefined>(undefined)
    const [optionalLabels, setOptionalLabels] = useState<LabelFromGql[] | undefined>(undefined)
    const classes = useStyles()
    const client = useApolloClient()
    const routes = useRoutes()
    const initialValues = useMemo(
        () =>
            ({
                requiredLabels: initialRequiredLabelIds || [],
                optionalLabels: initialOptionalLabelIds || [],
            } as FormValues),
        [initialRequiredLabelIds, initialOptionalLabelIds],
    )

    useQuery<LadderInitialGamesQuery, LadderInitialGamesQueryVariables>(ladderInitialGames, {
        variables: {
            ladderType,
            requiredLabels: initialRequiredLabelIds,
            optionalLabels: initialOptionalLabelIds,
            offset: 0,
            limit: PAGE_SIZE,
        },
        fetchPolicy: 'cache-first',
        ssr: true,
        onCompleted: response => {
            setLoading(false)
            setPage(response?.games?.ladder || [])
            setRequiredLabels(response?.authorizedRequiredLabels?.map(labelMapper))
            setOptionalLabels(response?.authorizedOptionalLabels?.map(labelMapper))
        },
    })

    const { games } = page

    return (
        <FinalForm<FormValues> initialValues={initialValues} onSubmit={() => {}}>
            {({ values }) => {
                const refreshList = ({
                    newOffset,
                    newRequiredLabels,
                    newOptionalLabels,
                }: {
                    newOffset?: number
                    newRequiredLabels?: string[]
                    newOptionalLabels?: string[]
                }) => {
                    setLoading(true)
                    client
                        .query<LadderMoreGamesQuery, LadderMoreGamesQueryVariables>({
                            query: ladderMoreGames,
                            variables: {
                                ladderType,
                                offset: newOffset !== undefined ? newOffset : offset,
                                limit: PAGE_SIZE,
                                requiredLabels: newRequiredLabels || values.requiredLabels,
                                optionalLabels: newOptionalLabels || values.optionalLabels,
                            },
                        })
                        .then(response => {
                            setPage(response.data.games.ladder)
                            setLoading(false)
                        })
                }

                const handleTabSwitch = (newLadderType: LadderType) => {
                    setLoading(true)
                    routes.push(routes.games(newLadderType, values.requiredLabels, values.optionalLabels))
                }

                const handleOffsetChanged = (newOffset: number) => {
                    setOffset(newOffset)
                    refreshList({ newOffset })
                }

                return (
                    <>
                        <Tabs<LadderType> tabs={tabs} selectedTab={ladderType} onSelectTab={handleTabSwitch} />
                        <div className={classes.row}>
                            <WidthFixer
                                className={classNames({ [classes.widthFixer]: true, [classes.loading]: loading })}
                            >
                                {(!games || !requiredLabels || !optionalLabels) && <BigLoading />}
                                {games && requiredLabels && optionalLabels && (
                                    <Row>
                                        <Col md={9}>
                                            {games.map(game => (
                                                <LadderGamePanel key={game.id} game={game} />
                                            ))}
                                            <Pager
                                                currentOffset={offset}
                                                pageSize={PAGE_SIZE}
                                                totalAmount={page.totalAmount ?? 0}
                                                onOffsetChanged={handleOffsetChanged}
                                            />
                                        </Col>
                                        <Col md={3} className={classes.labelsCol}>
                                            <LabelFilterFields
                                                requiredLabelList={requiredLabels}
                                                optionalLabelList={optionalLabels}
                                                onSelectionChanged={refreshList}
                                            />
                                        </Col>
                                    </Row>
                                )}
                            </WidthFixer>
                        </div>
                    </>
                )
            }}
        </FinalForm>
    )
}

export default LadderPanel
