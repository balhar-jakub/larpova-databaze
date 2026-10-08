import { Maybe, AllowedAction } from 'src/graphql/__generated__/typescript-operations'

/**
 * Convert file input value from the format stored by FormFileInput to graphql UploadedFileInput
 */
export const convertFileInput = (fileInput?: string) => {
    if (!fileInput) {
        return undefined
    }

    const pp = fileInput.split('\t')

    return {
        fileName: pp[0],
        contents: pp[1],
    }
}

const d2 = (num: number) => (num < 10 ? `0${num}` : `${num}`)

/**
 * Convert date input value from DD.MM.YYYY format to our date
 */
export const convertDateInput = (dateInput?: string) => {
    if (!dateInput) {
        return undefined
    }

    const d = dateInput.split('.')
    return `${d[2]}-${d2(parseInt(d[1], 10))}-${d2(parseInt(d[0], 10))}`
}

/**
 * Convert date from graphql ISO format to local format
 *
 * @param date Graphql date
 *
 * @return Local date
 */
export const convertDateFromGraphql = (date: string | null | undefined) => {
    if (!date) {
        return undefined
    }

    const d = date.split('-')
    return `${d[2]}.${d[1]}.${d[0]}`
}

export const canDelete = (allowedActions?: Maybe<AllowedAction[]>) =>
    allowedActions && allowedActions.includes(AllowedAction.Delete)

export const canEdit = (allowedActions?: Maybe<AllowedAction[]>) =>
    allowedActions && allowedActions.includes(AllowedAction.Edit)

/**
 * Whether the game the page asked for is gone. `gameById` answers null both for
 * a game that does not exist *and* for a soft-deleted one this viewer may not
 * see (editors and admins still get it), so the game detail page must not fall
 * back to its cached fragment: that is how a deleted game kept rendering from
 * the Apollo cache after `deleteGame` had reported success. While the query is
 * still in flight the answer is "not missing", so the page keeps its loading
 * state instead of flashing "game not found".
 */
export const isGameMissing = (loading: boolean, data?: { readonly gameById?: unknown } | null) =>
    !loading && !data?.gameById
