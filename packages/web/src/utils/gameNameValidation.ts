/**
 * Game-name validation shared by the client form (packages/web/src/utils/
 * validationUtils.ts) and the server mutations (api resolvers) — one list of
 * junk names, one minimum length, so the two sides can never drift apart.
 *
 * The junk list exists because the game edit form used to submit its own
 * save-button label as the name when the name field was left empty (prod DB
 * held games literally named "Uložit změny?", see audit 2026-11-01), and
 * two-character names ("D8") slipped through the old "required"-only check.
 */

export const MIN_GAME_NAME_LENGTH = 3

/** UI button labels that must never be stored as a game name (compared
 * case-insensitively, after trimming). Czech and English submit labels of
 * the game form across its versions. */
export const BUTTON_LABEL_GAME_NAMES: readonly string[] = [
    'uložit změny?',
    'uložit změny',
    'uložit',
    'save',
    'uloz',
]

export type GameNameRejection = 'empty' | 'tooShort' | 'buttonLabel'

/** Normalize a raw input the same way on both sides: trim + collapse the
 * button labels' comparison to lowercase. */
export const normalizeGameName = (name: unknown): string =>
    typeof name === 'string' ? name.trim() : ''

export const isButtonLabelGameName = (name: string): boolean => {
    const normalized = name.trim().toLowerCase()
    return BUTTON_LABEL_GAME_NAMES.some(label => label.toLowerCase() === normalized)
}

/**
 * Validate a raw game name. Returns null for a valid name, else the rejection
 * reason. Empty/undefined is 'empty' so the caller can pick its own message.
 */
export const validateGameName = (name: unknown): GameNameRejection | null => {
    const normalized = normalizeGameName(name)
    if (normalized.length === 0) return 'empty'
    if (normalized.length < MIN_GAME_NAME_LENGTH) return 'tooShort'
    if (isButtonLabelGameName(normalized)) return 'buttonLabel'
    return null
}
