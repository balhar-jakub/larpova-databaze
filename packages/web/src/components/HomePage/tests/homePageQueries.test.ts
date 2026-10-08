/**
 * The homepage documents travel from the browser to the server, so a document
 * the server refuses only shows up as an empty page: Apollo gets a 400 and the
 * blocks never render. Jest maps `*.graphql` imports to a stub (`{}`) — the
 * component tests mock Apollo and never look at the document — so the documents
 * are read from disk here and validated against the schema, with the `#import`
 * lines resolved the way next-plugin-graphql resolves them.
 *
 * This pins the failure that an unused fragment caused: `#import`-ing a
 * fragments file without spreading one of its fragments makes the server answer
 * `Fragment "x" is never used.` (NoUnusedFragments) and the signed-in homepage
 * stays empty while everything else on it renders.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSchema, parse, validate } from 'graphql'

const webRoot = fileURLToPath(new URL('../../../../', import.meta.url))

/** Reads a document and replaces every `#import` line with the imported file. */
const inline = (absolute: string, seen: Set<string> = new Set()): string => {
    if (seen.has(absolute)) {
        return ''
    }
    seen.add(absolute)

    return readFileSync(absolute, 'utf-8')
        .split('\n')
        .map((line) => {
            const imported = /^#import\s+"(.+)"\s*$/.exec(line)
            if (!imported) {
                return line
            }
            const target = imported[1].startsWith('.')
                ? path.resolve(path.dirname(absolute), imported[1])
                : path.resolve(webRoot, imported[1])
            return inline(target, seen)
        })
        .join('\n')
}

const schema = buildSchema(readFileSync(path.join(webRoot, 'src/graphql/schema.graphql'), 'utf-8'))

const documents = ['getHomePageData.graphql', 'homePageUser.graphql']

describe('homepage GraphQL documents', () => {
    it.each(documents)('%s passes the validation the server runs', (name) => {
        const source = inline(path.join(webRoot, 'src/components/HomePage/graphql', name))

        const errors = validate(schema, parse(source))

        expect(errors.map((error) => error.message)).toEqual([])
    })
})
