import React from 'react'
import { useTranslation } from 'src/lib/i18n'
import { GraphQLError } from 'graphql'

interface Props {
    readonly errorClass: string
    // GraphQLError extensions carry path as an array of segments — renderers
    // join it for display.
    readonly valuePath?: string
}

// GraphQLErrorExtensions is an index of unknown — the API contract is
// code: string and path: string[] (see GraphQLServerError errors).
// Accepts both GraphQLError (resolvers/links) and Apollo's flattened
// GraphQLFormattedError (error-link callbacks). Their extensions types
// differ only in readonly-ness, so the param takes the structural
// minimum: a possibly-absent record of extension values.
export const PropsFromGraphQLError = (error?: { extensions?: Record<string, unknown> }): Props => ({
    errorClass: (error?.extensions?.code as string | undefined) || 'UNKNOWN',
    valuePath: (error?.extensions?.path as string[] | undefined)?.join('.'),
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

    return <span>{t(key, { valuePath: valuePath ?? '' })}</span>
}

export default GraphQLErrorContent
