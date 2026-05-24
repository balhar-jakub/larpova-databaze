import React from 'react'
import { useTranslation } from 'react-i18next'
import { GraphQLError } from 'graphql'

interface Props {
    readonly errorClass: string
    readonly valuePath?: string
}

export const PropsFromGraphQLError = (error?: GraphQLError): Props => ({
    errorClass: error?.extensions?.code || 'UNKNOWN',
    valuePath: error?.extensions?.path,
})

const resolveSubKey = (errorClass: string) => {
    switch (errorClass) {
        case 'NETWORK':
        case 'NOT_FOUND':
        case 'INVALID_VALUE':
        case 'INVALID_STATE':
        case 'ACCESS_DENIED':
        case 'DUPLICATE_VALUE':
            return errorClass
        default:
            return 'UNKNOWN'
    }
}

const GraphQLErrorContent = ({ errorClass, valuePath }: Props): React.ReactElement => {
    const key = `GraphQLError.${resolveSubKey(errorClass)}`
    const { t } = useTranslation('common')

    return t(key, { valuePath })
}

export default GraphQLErrorContent
