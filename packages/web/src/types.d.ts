/**
 * Custom global types
 */

/**
 * String or key be translated
 */
type StringOrTranslatable = string | { key: string }

/**
 * GraphQL documents: next-plugin-graphql (webpack) turns these into a DocumentNode
 * at build time, the jest moduleNameMapper stubs them out.
 */
declare module '*.graphql' {
    const document: unknown
    export default document
}
