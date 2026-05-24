import React from 'react'
import fetch from 'isomorphic-unfetch'
import { ApolloClient, createHttpLink, InMemoryCache, from, InMemoryCacheConfig } from '@apollo/react-hooks'
import { onError } from '@apollo/client/link/error'
import { HttpOptions } from '@apollo/client/link/http/selectHttpOptionsAndBody'
import withApollo from 'next-with-apollo'
import { getDataFromTree } from '@apollo/client/react/ssr'
import { toastContextValue } from '../context/ToastContext/ToastContext'
import GraphQLErrorContent, {
    PropsFromGraphQLError,
} from '../components/common/GraphQLErrorContent/GraphQLErrorContent'

// Polyfill fetch() on the server (used by apollo-client)
if (!process.browser) {
    global.fetch = fetch
}

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
            if (graphQLErrors[0].extensions?.code) {
                const { errorClass, valuePath } = PropsFromGraphQLError(graphQLErrors[0])
                if (response) {
                    response.errors = undefined
                }
                toastContextValue.actions.showToast(
                    <GraphQLErrorContent errorClass={errorClass} valuePath={valuePath} />,
                    'alert',
                )
            } else {
                if (response) {
                    response.errors = undefined
                }
                toastContextValue.actions.showToast(<GraphQLErrorContent errorClass="UNKNOWN" />, 'alert')
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

                // Allow using fetchMore properly in usersByQuery
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

export const withApolloWrapper = withApollo(
    props => {
        const { initialState, headers } = props
        let uri = 'http://localhost:3000/graphql' // Fallback

        if (global.window) {
            // Do requests back to origin
            uri = `${global.window.location.origin}/graphql`
        } else if (headers?.host) {
            const host = headers?.['x-forwarded-host'] || headers?.host
            if (host) {
                const protocol = host.indexOf('localhost') >= 0 ? 'http://' : 'https://'
                uri = `${protocol}${host}/graphql`
            }
        }

        const httpLinkOptions: HttpOptions = {
            uri,
            credentials: 'same-origin',
        }

        if (headers) {
            // This is used on server to send requests with proper authorization (on client we don't have request)
            httpLinkOptions.headers = {
                cookie: headers.cookie,
            }
        }

        return new ApolloClient({
            link: from([errorLink, createHttpLink(httpLinkOptions)]),
            cache: new InMemoryCache(cacheConfig).restore(initialState || {}),
        })
    },
    {
        getDataFromTree,
    },
)
