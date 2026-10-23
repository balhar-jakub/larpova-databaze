import React from 'react'
import { useApolloClient } from '@apollo/client'
import {
    CommentsPaged,
    SetCommentVisibleMutation,
    SetCommentVisibleMutationVariables,
} from '../../../graphql/__generated__/typescript-operations'
import GameCommentPanel from '../GameCommentPanel/GameCommentPanel'
import { useLoggedInUser } from '../../../hooks/useLoggedInUser'
import { isAtLeastEditor } from '../../../utils/roleUtils'
import Pager from '../Pager/Pager'

const setCommentVisibleGql = require('./graphql/setCommentVisible.graphql')

interface Props {
    readonly page?: CommentsPaged
    readonly loading?: boolean
    readonly pageSize: number
    readonly offset: number
    readonly onOffsetChanged: (newOffset: number) => void
    /** Show `1.–25. z 121` next to the buttons — the catalog's pager does. */
    readonly rangeLabel?: boolean
}

const PagedCommentsPanel = ({ offset, loading, page, pageSize, onOffsetChanged, rangeLabel = false }: Props) => {
    const client = useApolloClient()
    const loggedInUser = useLoggedInUser()

    const handleChangeCommentVisibility = (commentId: string, isHidden: boolean) => {
        client.mutate<SetCommentVisibleMutation, SetCommentVisibleMutationVariables>({
            mutation: setCommentVisibleGql,
            variables: { commentId, visible: !isHidden },
        })
    }

    const showVisibilityButton = isAtLeastEditor(loggedInUser?.role)

    return (
        <>
            {page &&
                (page as CommentsPaged).comments.map(comment => (
                    <GameCommentPanel
                        key={comment.id}
                        comment={comment}
                        loading={loading}
                        showVisibilityButton={showVisibilityButton}
                        onChangeCommentVisibility={handleChangeCommentVisibility}
                    />
                ))}
            <Pager
                currentOffset={offset}
                totalAmount={page?.totalAmount || 0}
                pageSize={pageSize}
                onOffsetChanged={onOffsetChanged}
                rangeLabel={rangeLabel}
            />
        </>
    )
}

export default PagedCommentsPanel
