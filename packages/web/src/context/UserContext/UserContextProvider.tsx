import React, { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import isInBrowser from 'is-in-browser'
import { UserContext, UserContextShape, UserContextValue } from './UserContext'
import {
    LoggedInUserQuery,
    LoggedInUserQueryVariables,
    UserRole,
} from '../../graphql/__generated__/typescript-operations'

const loggedInUserGql = require('./graphql/loggedInUserQuery.graphql')

const UserContextProvider: React.FC = ({ children }) => {
    const [value, setValue] = useState<UserContextValue | undefined>(undefined)

    const query = useQuery<LoggedInUserQuery, LoggedInUserQueryVariables>(loggedInUserGql, {
        skip: !isInBrowser,
        fetchPolicy: 'network-only',
        onCompleted: (data: LoggedInUserQuery) => {
            const loggedInUser = data?.loggedInUser
            setValue(
                loggedInUser
                    ? {
                          id: loggedInUser.id,
                          name: loggedInUser.name,
                          nickName: loggedInUser.nickname ?? undefined,
                          imageId: loggedInUser.image?.id,
                          role: loggedInUser.role ?? UserRole.Anonymous,
                      }
                    : undefined,
            )
        },
        notifyOnNetworkStatusChange: true,
    })
    const { loading } = query

    const providerValue: UserContextShape | undefined = useMemo(() => {
        return {
            value: !value && !loading ? undefined : value ?? {},
            actions: {
                reload: async () => query.refetch(),
            },
        }
    }, [value, loading, query])

    return <UserContext.Provider value={providerValue}>{children}</UserContext.Provider>
}

export default UserContextProvider
