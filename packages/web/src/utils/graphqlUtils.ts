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
