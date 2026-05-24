import React, { useEffect, useState } from 'react'
import { useQuery } from '@apollo/client'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { createUseStyles } from 'react-jss'
import isInBrowser from 'is-in-browser'
import {
    CommentsPaged,
    MoreCommentsQuery,
    MoreCommentsQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import PagedCommentsPanel from '../common/PagedCommentsPanel/PagedCommentsPanel'
import { useLoggedInUser } from '../../hooks/useLoggedInUser'
import { IconDisabled, IconEdit, IconLoading, IconPlus } from '../common/Icons/Icons'

const EditCommentModal = React.lazy(() => import('./EditCommentModal'))

const moreCommentsGql = require('./graphql/moreComments.graphql')

interface Props {
    readonly gameId: string
    readonly commentsDisabled: boolean
}

export const PAGE_SIZE = 10

const useStyles = createUseStyles({
    commentButtonWrapper: {
        textAlign: 'right',
        marginBottom: 8,
        marginRight: 18,
    },
})

export const GamePagedCommentsPanel = ({ gameId, commentsDisabled }: Props) => {
    const [offset, setOffset] = useState(0)
    const [editModalShown, setEditModalShown] = useState(false)
    const [editModalLoaded, setEditModalLoaded] = useState(false)
    const [cachedPage, setCachedPage] = useState<CommentsPaged | undefined>(undefined)
    const classes = useStyles()
    const { t } = useTranslation('common')
    const loggedInUser = useLoggedInUser()

    // Clear cached page when gameId changes
    useEffect(() => {
        setCachedPage(undefined)
    }, [gameId])

    const query = useQuery<MoreCommentsQuery, MoreCommentsQueryVariables>(moreCommentsGql, {
        variables: {
            gameId,
            commentsOffset: offset,
            commentsLimit: PAGE_SIZE,
        },
        fetchPolicy: 'cache-and-network',
        skip: !isInBrowser,
        ssr: false,
        onCompleted: data => {
            setCachedPage(data?.gameById?.commentsPaged as CommentsPaged | undefined)
        },
    })

    const currentUsersComment = query.data?.gameById?.currentUsersComment?.comment

    const handleCommentSaved = () => {
        // We must refetch comments manually, since there might be comment added
        query.refetch()
        setEditModalShown(false)
    }

    const dataPage = query.data?.gameById?.commentsPaged as CommentsPaged
    const effectivePage = dataPage || cachedPage
    const pageLoading = !dataPage
    const editModalLoading = editModalShown && !editModalLoaded

    return (
        <>
            {loggedInUser?.id && cachedPage && (
                <div className={classes.commentButtonWrapper}>
                    {!currentUsersComment && !commentsDisabled && (
                        <Button
                            size="sm"
                            variant="dark"
                            onClick={() => setEditModalShown(true)}
                            disabled={editModalLoading}
                        >
                            {editModalLoading ? <IconLoading /> : <IconPlus />}
                            &nbsp;&nbsp;{t('GameDetail.addComment')}
                        </Button>
                    )}
                    {!currentUsersComment && commentsDisabled && (
                        <Button size="sm" variant="dark" disabled>
                            <IconDisabled />
                            &nbsp;&nbsp;{t('GameDetail.commentsDisabled')}
                        </Button>
                    )}
                    {currentUsersComment && (
                        <Button
                            size="sm"
                            variant="dark"
                            onClick={() => setEditModalShown(true)}
                            disabled={editModalLoading}
                        >
                            {editModalLoading ? <IconLoading /> : <IconEdit />}
                            &nbsp;&nbsp;{t('GameDetail.updateComment')}
                        </Button>
                    )}
                </div>
            )}
            {editModalShown && (
                <React.Suspense fallback={<span />}>
                    <EditCommentModal
                        gameId={gameId}
                        oldText={currentUsersComment || ''}
                        onHide={() => setEditModalShown(false)}
                        onLoad={() => setEditModalLoaded(true)}
                        onCommentSaved={handleCommentSaved}
                    />
                </React.Suspense>
            )}
            <PagedCommentsPanel
                page={effectivePage}
                loading={pageLoading}
                pageSize={PAGE_SIZE}
                offset={offset}
                onOffsetChanged={setOffset}
            />
        </>
    )
}
