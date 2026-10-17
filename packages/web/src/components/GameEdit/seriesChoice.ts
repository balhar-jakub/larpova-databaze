import type { SeriesChoice } from './SeriesAutoCompleteField'

/**
 * True when the form's series choice differs from the one the game had, so the
 * save can say "added to the series" instead of the generic "game updated".
 *
 * Two "create new" choices are never equal, even when they carry the same name:
 * a name that merely matches the stored one still goes through the mutation that
 * creates a series, so it must not read as "nothing changed".
 */
export const seriesChanged = (
    chosen: SeriesChoice | null | undefined,
    previous: SeriesChoice | null | undefined,
) => {
    const chosenId = chosen?.id ?? null
    const previousId = previous?.id ?? null
    // A different series on either side — added, removed or swapped.
    if (chosenId !== previousId) return true
    // The same stored series on both sides: nothing to save.
    if (chosenId) return false
    // Neither side names a stored series, so anything the visitor picked is a
    // "create new" choice, and the mutation creates a series for it.
    return Boolean(chosen) || Boolean(previous)
}
