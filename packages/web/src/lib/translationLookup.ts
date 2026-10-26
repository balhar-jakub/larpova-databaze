/**
 * Key resolution for the small i18n shim in `i18n.tsx`. Kept in a module with
 * neither React nor the router so the rules can be unit-tested.
 *
 * Nested path: `PageHeader.csld` → `data.PageHeader.csld`.
 *
 * Czech plurals: `_0` (1), `_1` (2–4), `_2` (0, 5+).
 *
 * Gender: the app talks about people in the first person (`Hrál jsem`), so the
 * wording depends on whose gender it is — the signed-in user for the rating
 * buttons, the owner of the profile for the profile lists. `context` picks the
 * `_male` / `_female` variant; the plain key stays the neutral fallback
 * (`Hrál/a jsem`) that an anonymous visitor and a user without a stated gender
 * read.
 *
 * Order for `getNested(data, 'UserDetail.player', { count: 3, context: 'female' })`:
 * `player_female_1` → `player_female` → `player_1` → `player`.
 */

export type NestedRecord = Record<string, unknown>

export function csPluralSuffix(count: number): string {
  if (count === 1) return '_0'
  if (count >= 2 && count <= 4) return '_1'
  return '_2'
}

/** Walks the dotted path; returns the parent object and the leaf value (which
 * must be a string for a translation to exist), or null when the path ends
 * early. */
function resolvePath(obj: NestedRecord, path: string): { parent: any; leaf: any } | null {
  let current: any = obj
  let parent: any = null
  for (const p of path.split('.')) {
    if (current == null || typeof current !== 'object') return null
    parent = current
    current = current[p]
  }
  return { parent, leaf: current }
}

/** The keys to try, most specific first: context+plural, context, the
 * neutral plain key, then the bare plural. The plain key is the neutral form
 * and the fallback for a language without gendered keys, so it never has to
 * be duplicated per gender. */
function translationCandidates(
  lastKey: string,
  leaf: unknown,
  context: string | null,
  pluralSuffix: string | null,
): string[] {
  const candidates: string[] = []
  if (context) {
    if (pluralSuffix) candidates.push(`${lastKey}_${context}${pluralSuffix}`)
    candidates.push(`${lastKey}_${context}`)
  }
  if (typeof leaf === 'string') candidates.push(lastKey)
  if (pluralSuffix) candidates.push(`${lastKey}${pluralSuffix}`)
  return candidates
}

export function getNested(obj: NestedRecord, path: string, options?: Record<string, unknown>): string {
  const lastKey = path.split('.').pop()!
  const resolved = resolvePath(obj, path)
  if (!resolved) return path
  const { parent, leaf } = resolved

  const context = typeof options?.context === 'string' && options.context ? (options.context as string) : null
  let pluralSuffix: string | null = null
  if (options?.count != null) {
    const count = Number(options.count)
    if (!isNaN(count)) pluralSuffix = csPluralSuffix(count)
  }

  for (const key of translationCandidates(lastKey, leaf, context, pluralSuffix)) {
    const value = parent?.[key]
    if (typeof value === 'string') return value
  }
  return path
}

/**
 * Resolve a key and fill in the `{{name}}` placeholders from `options`
 * (`count` also picks the plural form, `context` the gender variant).
 */
export function translate(obj: NestedRecord, path: string, options?: Record<string, unknown>): string {
  let result = getNested(obj, path, options)
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      result = result.replace(`{{${key}}}`, String(value))
    }
  }
  return result
}
