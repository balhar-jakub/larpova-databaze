import React, { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'src/lib/i18n'
import { createUseStyles } from 'react-jss'
import isInBrowser from 'is-in-browser'
import {
    CommentsPaged,
    MoreCommentsQuery,
    MoreCommentsQueryVariables,
    DeleteCommentMutation,
    DeleteCommentMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import PagedCommentsPanel from '../common/PagedCommentsPanel/PagedCommentsPanel'
import { useLoggedInUser } from '../../hooks/useLoggedInUser'
import { IconDisabled, IconEdit, IconLoading, IconPlus, IconTrash } from '../common/Icons/Icons'

const EditCommentModal = React.lazy(() => import('./EditCommentModal'))

const moreCommentsGql = require('./graphql/moreComments.graphql')
const deleteCommentGql = require('./graphql/deleteComment.graphql')

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
    const [deleteComment, { loading: deleteLoading }] = useMutation<DeleteCommentMutation, DeleteCommentMutationVariables>(
        deleteCommentGql,
    )

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
        fetchPolicy: 'network-only',
    })
    
    // Replace deprecated onCompleted with useEffect
    useEffect(() => {
        if (query.data?.gameById?.commentsPaged) {
            setCachedPage(query.data.gameById.commentsPaged as CommentsPaged)
        }
    }, [query.data])

    const currentUsersComment = query.data?.gameById?.currentUsersComment?.comment

    const handleCommentSaved = () => {
        // We must refetch comments manually, since there might be comment added
        query.refetch()
        setEditModalShown(false)
    }

    const handleDeleteComment = async () => {
        const commentId = query.data?.gameById?.currentUsersComment?.id
        if (!commentId) return
        try {
            await deleteComment({ variables: { commentId } })
            query.refetch()
        } catch {
            // error handling through Apollo link
        }
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
                        <>
                            <Button
                                size="sm"
                                variant="dark"
                                onClick={() => setEditModalShown(true)}
                                disabled={editModalLoading}
                            >
                                {editModalLoading ? <IconLoading /> : <IconEdit />}
                                &nbsp;&nbsp;{t('GameDetail.updateComment')}
                            </Button>
                            &nbsp;
                            <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={handleDeleteComment}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? <IconLoading /> : <IconTrash />}
                                &nbsp;&nbsp;{t('GameDetail.deleteComment')}
                            </Button>
                        </>
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
