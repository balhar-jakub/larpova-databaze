// Apollo Client factory — creates ApolloClient instances with our
// cache configuration and error handling. Works with ApolloProvider
// from @apollo/client for both SSR and client-side rendering.
// Uses plain @apollo/client (not the experimental package) since
// ApolloNextAppProvider requires App Router.

import { HttpLink, InMemoryCache, InMemoryCacheConfig, from } from '@apollo/client/index.js'
import { ApolloClient } from '@apollo/client/index.js'
import { onError } from '@apollo/client/link/error/index.js'
import { toastContextValue } from '../context/ToastContext/ToastContext'
import GraphQLErrorContent, {
    PropsFromGraphQLError,
} from '../components/common/GraphQLErrorContent/GraphQLErrorContent'

// Operations that do their own error handling
const errorHandlingOperations = ['ChangePassword']

const errorLink = onError(({ graphQLErrors, networkError, operation, response }) => {
    const hasCustomErrorHandling = errorHandlingOperations.includes(operation.operationName)

    if (networkError) {
        if (response && !hasCustomErrorHandling) {
            response.errors = undefined
        }
        toastContextValue.actions.showToast(<GraphQLErrorContent errorClass="NETWORK" />, 'alert')
    }

    if (!hasCustomErrorHandling && graphQLErrors && graphQLErrors.length > 0) {
        const { errorClass, valuePath } = PropsFromGraphQLError(graphQLErrors[0])
        if (response) {
            response.errors = undefined
        }
        const isMutation = (
            operation.query.definitions as readonly { kind: string; operation?: string }[]
        ).some((def) => def.kind === 'OperationDefinition' && def.operation === 'mutation')
        if (isMutation) {
            toastContextValue.actions.showToast(
                <GraphQLErrorContent errorClass={errorClass} valuePath={valuePath} />,
                'alert',
            )
        }
    }
})

// Field policy shorthand: shallow-merge the written object over the cached one
// (partial writes must not wipe sibling fields the query did not select).
type MergeableField = { merge: (existing: Record<string, unknown> | null, incoming: Record<string, unknown>) => Record<string, unknown> }
const simpleMerge: MergeableField = { merge: (existing, incoming) => ({ ...existing, ...incoming }) }
const overwriteMerge: MergeableField = { merge: (_existing, incoming) => incoming }

const cacheConfig: InMemoryCacheConfig = {
    typePolicies: {
        Query: {
            fields: {
                games: simpleMerge,
                admin: simpleMerge,
                homepage: simpleMerge,
                usersByQuery: {
                    keyArgs: ['query'],
                    merge: (existing = [], incoming) => [...existing, ...incoming],
                },
            },
        },
        Mutation: {
            fields: {
                user: simpleMerge,
                game: simpleMerge,
                group: simpleMerge,
                event: simpleMerge,
                admin: simpleMerge,
            },
        },
        Game: {
            fields: {
                ratingStats: overwriteMerge,
                ratings: overwriteMerge,
            },
        },
    },
}

export function makeClient() {
    const httpLink = new HttpLink({
        uri: '/graphql',
        credentials: 'same-origin',
    })

    return new ApolloClient({
        link: from([errorLink, httpLink]),
        cache: new InMemoryCache(cacheConfig),
    })
}
