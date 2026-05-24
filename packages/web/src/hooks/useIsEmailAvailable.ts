import { useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { CheckEmailQuery, CheckEmailQueryVariables, User } from '../graphql/__generated__/typescript-operations'

const checkEmailGql = require(`./graphql/checkEmailQuery.graphql`)

type OurUser = Pick<User, 'id' | 'email' | 'name' | 'nickname'>

export const useIsEmailAvailable = () => {
    const [usedByUser, setUsedByUser] = useState<OurUser | undefined>(undefined)
    const client = useApolloClient()

    const isEmailAvailable = async (email: string | undefined, currentUserId?: string) => {
        if (email) {
            // Check whether user exists
            const result = await client.query<CheckEmailQuery, CheckEmailQueryVariables>({
                query: checkEmailGql,
                variables: { email },
                fetchPolicy: 'network-only',
            })

            const { userByEmail } = result.data
            if (userByEmail && userByEmail.id !== currentUserId) {
                // Email used by someone other than the current user
                setUsedByUser(userByEmail)
                return false
            }
        }
        setUsedByUser(undefined)
        return true
    }

    return { usedByUser, isEmailAvailable }
}
