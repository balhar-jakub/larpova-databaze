import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { Row, Col } from 'react-bootstrap'
import {
    CachedGameDataFragment,
    CommentsPaged,
    DeleteGameMutation,
    DeleteGameMutationVariables,
    GameDetailQuery,
    GameDetailQueryVariables,
    RestoreGameMutation,
    RestoreGameMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { GameHeaderPanel } from './GameHeaderPanel'
import { GameRatingPanel } from './GameRatingPanel'
import { GameListPanel } from '../common/GameListPanel/GameListPanel'
import { EventListPanel } from '../HomePage/EventListPanel'
import { GamePagedCommentsPanel } from './GamePagedCommentsPanel'
import RatingsListPanel from './RatingsListPanel'
import { isAtLeastEditor } from '../../utils/roleUtils'
import { useLoggedInUser } from '../../hooks/useLoggedInUser'
import ActionButton from '../common/ActionButton/ActionButton'
import ConfirmationModal from '../common/ConfirmationModal/ConfirmationModal'
import { useRoutes } from '../../hooks/useRoutes'
import { canDelete, canEdit, isGameMissing } from '../../utils/graphqlUtils'
import { useShowToast } from '../../hooks/useShowToast'
import { searchInputId } from '../common/PageHeader/HeaderSearchForm'
import { htmlToText } from '../../utils/textUtils'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'

const cachedGameDataGql = require('./graphql/cachedGameData.graphql')
const gameDetailGql = require('./graphql/gameDetail.graphql')
const deleteGameGql = require('./graphql/deleteGame.graphql')
const restoreGameGql = require('./graphql/restoreGame.graphql')

interface Props {
    readonly gameId: string
}

const useStyles = createUseStyles({
    details: {
        backgroundColor: darkTheme.background,
    },
    detailsRow: {
        paddingTop: 20,
    },
    detailsColumn: {
        paddingBottom: 20,
    },
    extras: {
        backgroundColor: darkTheme.backgroundNearWhite,
        padding: '10px 0',
    },
    extrasColumn: {
        margin: '10px 0',
    },
    coverImage: {
        width: '100%',
        minHeight: '29.75vw',
    },
    deletedNotice: {
        backgroundColor: darkTheme.red,
        color: darkTheme.backgroundNearWhite,
        padding: '10px 15px',
        marginTop: 10,
    },
})

type TabTabs = 'comments' | 'photos' | 'video'

const tabComments: TabDefinition<TabTabs> = {
    key: 'comments',
    title: {
        key: 'GameDetail.comments',
    },
}

// const tabPhotos: TabDefinition<TabTabs> = {
//     key: 'photos',
//     title: {
//         key: 'GameDetail.photos',
//     },
// }

const tabVideo: TabDefinition<TabTabs> = {
    key: 'video',
    title: {
        key: 'GameDetail.video',
    },
}

const emptyGame = {
    name: '',
    description: '',
    labels: [],
    authors: [],
    groupAuthor: [],
    averageRating: 0,
    amountOfRatings: 0,
    ratingStats: [],
    similarGames: [],
    gamesOfAuthors: [],
    events: [],
    photos: [],
    video: undefined,
    allowedActions: [],
    ratings: [],
    currentUsersComment: undefined,
    coverImage: undefined,
    commentsDisabled: true,
    ratingsDisabled: true,
    commentsPaged: {
        comments: [],
        totalAmount: -1,
    } as CommentsPaged,
}

export const GameDetailPanel = ({ gameId }: Props) => {
    const [selectedTab, setSelectedTab] = useState<TabTabs>('comments')
    const [deleteConfirmShown, setDeleteConfirmShown] = useState(false)
    const loggedInUser = useLoggedInUser()
    const { t } = useTranslation('common')
    const classes = useStyles()
    const routes = useRoutes()
    const showToast = useShowToast()
    const [deleteGame, { loading: deleteLoading }] = useMutation<DeleteGameMutation, DeleteGameMutationVariables>(
        deleteGameGql,
        {
            variables: {
                gameId,
            },
        },
    )
    const [restoreGame] = useMutation<RestoreGameMutation, RestoreGameMutationVariables>(restoreGameGql, {
        variables: {
            gameId,
        },
    })
    const gameQuery = useQuery<GameDetailQuery, GameDetailQueryVariables>(gameDetailGql, {
        variables: {
            gameId,
        },
        fetchPolicy: 'network-only',
    })
    let gameFragment: CachedGameDataFragment | undefined | null

    // Defocus header search input on first render of the game, hiding the menu
    // Not a very React-ish way, but it is the most simple
    useEffect(() => {
        document.getElementById(searchInputId)?.blur()
    }, [gameId])

    try {
        // Throws exception on server, so we guard it
        gameFragment = gameQuery.client.readFragment<CachedGameDataFragment>({
            id: `Game:${gameId}`,
            fragment: cachedGameDataGql,
        })
    } catch (e) {
        // Object in cache but does not have required data - just continue
        // eslint-disable-next-line no-console
        console.log('Fetch failed', e)
    }

    const game = gameQuery.data?.gameById || {
        ...emptyGame,
        ...gameFragment,
        id: `${gameId}`,
    }

    // `gameById` answers null both for a game that does not exist and for one
    // this viewer may not see — a soft-deleted game is served to editors and
    // admins only. The cached fragment above must therefore not decide whether
    // the game exists, or a deleted game kept rendering from the cache.
    const gameMissing = isGameMissing(gameQuery.loading, gameQuery.data)

    const tabs: Array<TabDefinition<TabTabs>> = [tabComments]
    if (game.video?.path) {
        tabs.push(tabVideo)
    }

    const handleRefetch = () => gameQuery.refetch()

    const handleEditGame = () => {
        routes.push(routes.gameEdit(gameId))
    }

    const handleDeleteGame = () => setDeleteConfirmShown(true)

    const handleHideDeleteModal = () => setDeleteConfirmShown(false)

    const handleDoDeleteGame = () => {
        deleteGame().then(res => {
            if (res.data) {
                setDeleteConfirmShown(false)
                showToast(t('GameDetail.gameDeleted'), 'success')
                routes.push(routes.homepage())
            }
        })
    }

    // Restoring keeps the viewer on the page — the game is back and the query
    // returns it again.
    const handleRestoreGame = () => {
        restoreGame().then(res => {
            if (res.data) {
                showToast(t('GameDetail.gameRestored'), 'success')
                gameQuery.refetch()
            }
        })
    }

    const editVisible = canEdit(game?.allowedActions)
    const deleteVisible = canDelete(game?.allowedActions)

    const gameImageUrl = game.coverImage ? `/game-image/?id=${game.id}&imageId=${game.coverImage.id}` : undefined
    const gameDescription = game.description
    const textDescription = useMemo(() => htmlToText(gameDescription).substring(0, 300), [gameDescription])

    // A game that is gone — deleted by an editor, or a link to a game that never
    // existed — has nothing to show. The legacy site answered 404 here. This sits
    // after every hook on purpose: an early return above them would change the
    // number of hooks between renders.
    if (gameMissing) {
        return (
            <div className={classes.details}>
                <WidthFixer>
                    <h2>{t('GameDetail.gameNotFound')}</h2>
                </WidthFixer>
            </div>
        )
    }

    return (
        <div className={classes.details}>
            <OpenGraphMeta title={game.name ?? ''} description={textDescription} image={gameImageUrl} />
            {game.deleted && (
                <WidthFixer>
                    <div className={classes.deletedNotice}>{t('GameDetail.deletedGameNotice')}</div>
                </WidthFixer>
            )}
            {gameImageUrl && <img className={classes.coverImage} alt="" src={gameImageUrl} />}
            <WidthFixer>
                <Row className={classes.detailsRow}>
                    <Col lg={8} md={6} className={classes.detailsColumn}>
                        <GameHeaderPanel game={game} />
                    </Col>
                    <Col lg={4} md={6} className={classes.detailsColumn}>
                        <GameRatingPanel game={game} />
                    </Col>
                </Row>
            </WidthFixer>
            <Tabs tabs={tabs} selectedTab={selectedTab} onSelectTab={setSelectedTab} />
            <div className={classes.extras}>
                <WidthFixer>
                    <Row>
                        <Col lg={9} className={classes.extrasColumn}>
                            {selectedTab === 'comments' && (
                                <GamePagedCommentsPanel gameId={gameId} commentsDisabled={!!game.commentsDisabled} />
                            )}
                            {selectedTab === 'video' && (
                                <iframe title="video" src={game.video?.path || ''} width="800" height="450" />
                            )}
                        </Col>
                        <Col lg={3} className={classes.extrasColumn}>
                            {editVisible && (
                                <ActionButton onClick={handleEditGame}>{t('GameDetail.editGame')}</ActionButton>
                            )}
                            {deleteVisible && !game.deleted && (
                                <ActionButton onClick={handleDeleteGame}>{t('GameDetail.deleteGame')}</ActionButton>
                            )}
                            {/* A deleted game is served to editors and admins only, and
                                `allowedActions` leaves out Delete for it — what they need
                                is the way back. */}
                            {game.deleted && (
                                <ActionButton onClick={handleRestoreGame}>{t('GameDetail.restoreGame')}</ActionButton>
                            )}
                            <GameListPanel games={game.similarGames} titleKey="GameDetail.similarGames" />
                            <EventListPanel events={game.events} titleKey="GameDetail.events" />
                            <GameListPanel games={game.gamesOfAuthors} titleKey="GameDetail.gamesOfAuthors" />
                            {isAtLeastEditor(loggedInUser?.role) && (
                                <RatingsListPanel
                                    gameId={game.id}
                                    ratings={game.ratings}
                                    onRatingDeleted={handleRefetch}
                                />
                            )}
                        </Col>
                    </Row>
                </WidthFixer>
            </div>
            <ConfirmationModal
                show={deleteConfirmShown}
                content={t('GameDetail.deleteGameConfirmation')}
                loading={deleteLoading}
                onHide={handleHideDeleteModal}
                onCancel={handleHideDeleteModal}
                onConfirm={handleDoDeleteGame}
            />
        </div>
    )
}
