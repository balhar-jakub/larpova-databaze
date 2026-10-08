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

export function getNested(obj: NestedRecord, path: string, options?: Record<string, unknown>): string {
  const parts = path.split('.')
  let current: any = obj
  let parent: any = null
  const lastKey = parts[parts.length - 1]
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return path
    parent = current
    current = current[p]
  }

  const context = typeof options?.context === 'string' && options.context ? (options.context as string) : null
  let pluralSuffix: string | null = null
  if (options?.count != null) {
    const count = Number(options.count)
    if (!isNaN(count)) pluralSuffix = csPluralSuffix(count)
  }

  const candidates: string[] = []
  if (context) {
    if (pluralSuffix) candidates.push(`${lastKey}_${context}${pluralSuffix}`)
    candidates.push(`${lastKey}_${context}`)
  }
  // The plain key is the neutral form and the fallback for a language without
  // gendered keys, so it never has to be duplicated per gender.
  if (typeof current === 'string') candidates.push(lastKey)
  if (pluralSuffix) candidates.push(`${lastKey}${pluralSuffix}`)

  for (const key of candidates) {
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
