import React from 'react'
import { useQuery } from '@apollo/client'
import isInBrowser from 'is-in-browser'
import {
    LoadCurrentUserProfileQuery,
    LoadCurrentUserProfileQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import UserProfilePanel from './UserProfilePanel'
import { PAGE_SIZE } from './UserPagedCommentsPanel'

const userDataGql = require('./graphql/loadCurrentUserProfile.graphql')

const CurrentUserProfileContainer = () => {
    const userDataQuery = useQuery<LoadCurrentUserProfileQuery, LoadCurrentUserProfileQueryVariables>(userDataGql, {
        skip: !isInBrowser,
        fetchPolicy: 'cache-and-network',
        variables: {
            commentsLimit: PAGE_SIZE,
        },
    })
    const user = userDataQuery.data?.loggedInUser

    return <UserProfilePanel userId={user?.id} user={user} />
}

export default CurrentUserProfileContainer
