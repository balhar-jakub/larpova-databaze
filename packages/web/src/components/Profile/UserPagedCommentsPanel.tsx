import React, { useRef, useState } from 'react'
import { useQuery, useMutation, useApolloClient } from '@apollo/client'
import isInBrowser from 'is-in-browser'
import { useTranslation } from 'src/lib/i18n'
import {
    CommentsPaged,
    MoreUserCommentsQuery,
    MoreUserCommentsQueryVariables,
    DeleteCommentMutation,
    DeleteCommentMutationVariables,
} from '../../graphql/__generated__/typescript-operations'
import PagedCommentsPanel from '../common/PagedCommentsPanel/PagedCommentsPanel'
import { useShowToast } from '../../hooks/useShowToast'

const EditCommentModal = React.lazy(() => import('../GameDetail/EditCommentModal'))

const moreUserCommentsQuery = require('./graphql/moreUserComments.graphql')
const deleteCommentGql = require('../GameDetail/graphql/deleteComment.graphql')

interface Props {
    readonly userId: string
    readonly firstPage: CommentsPaged
    /** Own profile page — offer edit/delete on the logged-in user's comments. */
    readonly manageable?: boolean
}

export const PAGE_SIZE = 10

const UserPagedCommentsPanel = ({ userId, firstPage, manageable }: Props) => {
    const [offset, setOffset] = useState(0)
    const [editingCommentId, setEditingCommentId] = useState<string | undefined>(undefined)
    const lastPageRef = useRef<CommentsPaged | undefined>(firstPage)
    const client = useApolloClient()
    const { t } = useTranslation('common')
    const showToast = useShowToast()
    const [deleteComment] = useMutation<DeleteCommentMutation, DeleteCommentMutationVariables>(deleteCommentGql)
    const query = useQuery<MoreUserCommentsQuery, MoreUserCommentsQueryVariables>(moreUserCommentsQuery, {
        variables: {
            userId,
            offset,
            limit: PAGE_SIZE,
        },
        fetchPolicy: 'cache-and-network',
        skip: (!!firstPage && offset === 0) || !isInBrowser,
        ssr: false,
    })

    lastPageRef.current =
        (query.data && (query.data.userById?.commentsPaged as CommentsPaged)) ||
        (offset === 0 ? firstPage : lastPageRef.current)
    const page = lastPageRef.current

    const editingComment = page?.comments.find(c => c.id === editingCommentId)

    const refetchComments = () => client.refetchQueries({ include: ['LoadCurrentUserProfile', 'MoreUserComments'] })

    const handleEditComment = (commentId: string) => {
        setEditingCommentId(commentId)
    }

    const handleDeleteComment = async (commentId: string) => {
        try {
            await deleteComment({ variables: { commentId } })
            showToast(t('GameDetail.commentDeleted'), 'success')
            await refetchComments()
        } catch {
            // error handling through Apollo link
        }
    }

    const handleCommentSaved = () => {
        setEditingCommentId(undefined)
        refetchComments()
    }

    return (
        <>
            <PagedCommentsPanel
                page={page}
                loading={query.loading}
                pageSize={PAGE_SIZE}
                offset={offset}
                onOffsetChanged={setOffset}
                manageable={manageable}
                onEditComment={manageable ? handleEditComment : undefined}
                onDeleteComment={manageable ? handleDeleteComment : undefined}
            />
            {manageable && editingComment?.game && (
                <React.Suspense fallback={<span />}>
                    <EditCommentModal
                        gameId={editingComment.game.id}
                        oldText={editingComment.comment || ''}
                        onHide={() => setEditingCommentId(undefined)}
                        onLoad={() => undefined}
                        onCommentSaved={handleCommentSaved}
                    />
                </React.Suspense>
            )}
        </>
    )
}

export default UserPagedCommentsPanel
