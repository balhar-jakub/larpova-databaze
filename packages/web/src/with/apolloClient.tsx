// Apollo Client factory — creates ApolloClient instances with our
// cache configuration and error handling. Works with ApolloProvider
// from @apollo/client for both SSR and client-side rendering.
// Uses plain @apollo/client (not the experimental package) since
// ApolloNextAppProvider requires App Router.

import { HttpLink, InMemoryCache, InMemoryCacheConfig } from '@apollo/client/index.js'
import { ApolloClient } from '@apollo/client/index.js'
import { onError } from '@apollo/client/link/error/index.js'
import { from } from '@apollo/client/index.js'
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

    if (!hasCustomErrorHandling) {
        if (graphQLErrors && graphQLErrors.length > 0) {
            const { errorClass, valuePath } = PropsFromGraphQLError(graphQLErrors[0])
            if (response) {
                response.errors = undefined
            }
            const isMutation = (operation.query.definitions as any[]).some(
                (def: any) => def.kind === 'OperationDefinition' && def.operation === 'mutation'
            )
            if (isMutation) {
                toastContextValue.actions.showToast(
                    <GraphQLErrorContent errorClass={errorClass} valuePath={valuePath} />,
                    'alert',
                )
            }
        }
    }
})

const simpleMerge = { merge: (existing: any, incoming: any) => ({ ...existing, ...incoming }) }
const overwriteMerge = { merge: (existing: any, incoming: any) => incoming }

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
        link: httpLink,
        cache: new InMemoryCache(cacheConfig),
    })
}
