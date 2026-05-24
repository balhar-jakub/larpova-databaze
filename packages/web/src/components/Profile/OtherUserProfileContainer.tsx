import React from 'react'
import { useQuery } from '@apollo/client'
import isInBrowser from 'is-in-browser'
import { LoadUserProfileQuery, LoadUserProfileQueryVariables } from '../../graphql/__generated__/typescript-operations'
import UserProfilePanel from './UserProfilePanel'
import { PAGE_SIZE } from './UserPagedCommentsPanel'

const userDataGql = require('./graphql/loadUserProfile.graphql')

interface Props {
    readonly userId: string
}

const OtherUserProfileContainer = ({ userId }: Props) => {
    const userDataQuery = useQuery<LoadUserProfileQuery, LoadUserProfileQueryVariables>(userDataGql, {
        skip: !isInBrowser,
        fetchPolicy: 'cache-and-network',
        variables: {
            userId,
            commentsLimit: PAGE_SIZE,
        },
    })
    const user = userDataQuery.data?.userById
    const profileOnly = !user || user.id !== userDataQuery.data?.loggedInUser?.id

    return <UserProfilePanel userId={userId} user={user} profileOnly={profileOnly} />
}

export default OtherUserProfileContainer
