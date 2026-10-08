const entities = {
    amp: '&',
    lt: '<',
    gt: '>',
    nbsp: ' ',
    Aacute: 'Á',
    Eacute: 'É',
    Iacute: 'Í',
    Oacute: 'Ó',
    Uacute: 'Ú',
    Uring: 'Ů',
    Yacute: 'Ý',
    aacute: 'á',
    eacute: 'é',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    uring: 'ů',
    yacute: 'ý',
}

export const htmlToText = (html: string | null | undefined) => {
    if (!html) {
        return ''
    }
    return html
        .replace(/(<([^>]+)>)/gi, '')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&([^;]+);/g, (match, code: string) => {
            // @ts-ignore
            const entity = entities[code]
            if (entity) {
                return entity
            }
            return code[0]
        })
        .replace(/\n/g, ' ')
}

// ── Highlighting search hits ─────────────────────────────

/** Mirrors MIN_QUERY_LENGTH in packages/api/src/resolvers/search.ts. */
export const MIN_MATCH_QUERY_LENGTH = 2

/** Mirrors MAX_QUERY_TOKENS in packages/api/src/resolvers/search.ts. */
const MAX_MATCH_TOKENS = 6

const MATCH_WORD_SEPARATOR = /[^a-z0-9]/

/** Folds one character, never changing the number of characters. */
const foldChar = (char: string): string => {
    const base = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return (base.length === 1 ? base : char).toLowerCase()
}

/**
 * Lower case without diacritics. The folding is done character by character so
 * the result has the same length as the input — the results are highlighted by
 * index and a fold that changed the length would point the highlight at the
 * wrong letters. Keeps the rule of `foldSearchText` in the API search engine.
 */
export const foldForMatch = (value: string | null | undefined): string =>
    Array.from(value ?? '')
        .map(foldChar)
        .join('')

/** The words of a query, the way the API engine tokenizes them. */
export const tokenizeMatchQuery = (query?: string | null): string[] => {
    const folded = foldForMatch((query ?? '').trim())
    if (folded.length < MIN_MATCH_QUERY_LENGTH) return []

    const tokens = folded.split(/[^a-z0-9]+/).filter((token) => token.length > 0)
    return Array.from(new Set(tokens)).slice(0, MAX_MATCH_TOKENS)
}

export interface HighlightSegment {
    readonly value: string
    readonly matched: boolean
}

/**
 * Does a text (or any of several texts) match a query the way the API engine
 * matches it? Every word of the query has to be found at the start of a word,
 * in any order; a query too short to search matches everything, exactly like
 * the server, which ignores it.
 */
export const matchTextQuery = (
    values: string | readonly (string | null | undefined)[] | null | undefined,
    query?: string | null,
): boolean => {
    const tokens = tokenizeMatchQuery(query)
    if (tokens.length === 0) return true

    const list = Array.isArray(values) ? values : [values]
    const words = (list as readonly (string | null | undefined)[])
        .flatMap((value) => foldForMatch(value).split(/[^a-z0-9]+/))
        .filter((word) => word.length > 0)

    return tokens.every(
        (token) => words.some((word) => word.startsWith(token)) || words.some((word) => word.includes(token)),
    )
}

/**
 * Splits a text into the parts a query word hit and the parts it did not, so a
 * result list can show *why* somebody matched (`novak` also lights up `Novák`
 * and `Nováková`). Uses the engine's rule: a query word matches at the start of
 * a word, inside a word only as a last resort.
 */
export const highlightSegments = (text: string | null | undefined, query?: string | null): HighlightSegment[] => {
    const value = text ?? ''
    const chars = Array.from(value)
    const tokens = tokenizeMatchQuery(query)
    if (chars.length === 0 || tokens.length === 0) {
        return [{ value, matched: false }]
    }

    const flat = chars.map(foldChar).join('')
    const flags = chars.map(() => false)
    const mark = (start: number, length: number) => {
        for (let index = start; index < start + length && index < flags.length; index++) {
            flags[index] = true
        }
    }
    const isWordStart = (index: number) => index === 0 || MATCH_WORD_SEPARATOR.test(flat[index - 1])

    tokens.forEach((token) => {
        let matchedAtWordStart = false
        for (let index = 0; index + token.length <= flat.length; index++) {
            if (!flat.startsWith(token, index) || !isWordStart(index)) continue
            mark(index, token.length)
            matchedAtWordStart = true
        }
        if (matchedAtWordStart) return

        for (let index = 0; index + token.length <= flat.length; index++) {
            if (flat.startsWith(token, index)) mark(index, token.length)
        }
    })

    const segments: HighlightSegment[] = []
    chars.forEach((char, index) => {
        const last = segments[segments.length - 1]
        if (last && last.matched === flags[index]) {
            segments[segments.length - 1] = { value: last.value + char, matched: last.matched }
        } else {
            segments.push({ value: char, matched: flags[index] })
        }
    })

    return segments
}
