import React, { useRef, useState } from 'react'
import { useQuery } from '@apollo/client'
import isInBrowser from 'is-in-browser'
import {
    CommentsPaged,
    MoreUserCommentsQuery,
    MoreUserCommentsQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import PagedCommentsPanel from '../common/PagedCommentsPanel/PagedCommentsPanel'

const moreUserCommentsQuery = require('./graphql/moreUserComments.graphql')

interface Props {
    readonly userId: string
    readonly firstPage: CommentsPaged
}

export const PAGE_SIZE = 10

const UserPagedCommentsPanel = ({ userId, firstPage }: Props) => {
    const [offset, setOffset] = useState(0)
    const lastPageRef = useRef<CommentsPaged | undefined>(firstPage)
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

    return (
        <PagedCommentsPanel
            page={page}
            loading={query.loading}
            pageSize={PAGE_SIZE}
            offset={offset}
            onOffsetChanged={setOffset}
        />
    )
}

export default UserPagedCommentsPanel
