import { format } from 'date-fns'
import { Maybe } from 'graphql/jsutils/Maybe'

export const parseDateTime = (isoString?: string | null) => {
    if (!isoString) {
        return undefined
    }

    return new Date(isoString)
}

export const hasTimePart = (date?: Date) => date && (date.getHours() !== 0 || date.getMinutes() !== 0)

export const formatTimeRange = (from?: string | null, to?: string | null) => {
    const fromDate = parseDateTime(from)
    const toDate = parseDateTime(to)
    const justDates = !hasTimePart(fromDate) && !hasTimePart(toDate)
    const fromFormatted = fromDate && format(fromDate, justDates ? 'd.M.yyy' : 'd.M.yyy HH:mm')
    const toFormatted = toDate && format(toDate, justDates ? 'd.M.yyy' : 'd.M.yyy HH:mm')
    const justOneDate = fromFormatted === toFormatted
    const future = (fromDate?.getTime() || 0) > new Date().getTime()

    return { justOneDate, fromFormatted, toFormatted, future }
}

export const computeAge = (birthDate: Maybe<string>) => {
    if (!birthDate) {
        return 0
    }

    return Math.round((new Date().getTime() - new Date(birthDate).getTime()) / (365.2425 * 24 * 60 * 60 * 1000))
}

export const formatISODate = (date?: Date) => (date ? format(date, 'yyyy-MM-dd') : undefined)
