/**
 * The all-comments page's GraphQL document travels from the browser to the
 * server, so a document the server refuses renders as an empty page (Apollo
 * gets a 400). Jest maps `*.graphql` imports to a stub (`{}`) — the component
 * tests mock Apollo and never look at the document — so it is read from disk
 * here and validated against the schema, the same guard the homepage documents
 * have (homePageQueries.test.ts).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSchema, parse, validate } from 'graphql'

const webRoot = fileURLToPath(new URL('../../../../', import.meta.url))

const schema = buildSchema(readFileSync(path.join(webRoot, 'src/graphql/schema.graphql'), 'utf-8'))

describe('the all-comments GraphQL documents', () => {
    it('allCommentsPage.graphql passes the validation the server runs', () => {
        const source = readFileSync(
            path.join(webRoot, 'src/components/Comments/graphql/allCommentsPage.graphql'),
            'utf-8',
        )

        const errors = validate(schema, parse(source))

        expect(errors.map((error) => error.message)).toEqual([])
    })
})
