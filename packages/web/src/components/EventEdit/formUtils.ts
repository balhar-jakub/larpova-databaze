import { EditorState } from 'draft-js'
import { TFunction } from 'i18next'
import { CreateEventInput, Event, Game, Label, Maybe } from '../../graphql/__generated__/typescript-operations'
import { editorStateToHtml } from '../common/form/richTextInputUtils'
import { createGameLabel, LinkedGame } from './GamesAutoCompleteField'
import { fieldValidator, validateRequired, validateTime } from '../../utils/validationUtils'
import { NewLabel } from '../common/form/NewLabelsField'
import { formatISODate } from '../../utils/dateUtils'

const buildDateTime = (date?: Date, time?: string) =>
    time ? `${formatISODate(date)}T${time}:00` : `${formatISODate(date)}T00:00:00`

export interface FormValues {
    name: string
    fromDate?: Date
    fromTime?: string
    toDate?: Date
    toTime?: string
    amountOfPlayers?: string
    web?: string
    loc: string
    games: LinkedGame[]
    description?: string | EditorState
    requiredLabels: string[]
    optionalLabels: string[]
    newLabels: NewLabel[]
}

const timeRe = /^([0-9]+):([0-9]+)$/
const parseMinutes = (value: string): number => {
    const match = timeRe.exec(value)
    if (!match) {
        return 0
    }

    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

export const validate = (t: TFunction) => (data: FormValues) => {
    const res = {} as { [key in keyof FormValues]: string | undefined }
    res.fromDate = fieldValidator(t, validateRequired)(data.fromDate)
    res.toDate = fieldValidator(t, validateRequired)(data.toDate)

    res.fromTime = fieldValidator(t, validateTime)(data.fromTime)
    res.toTime = fieldValidator(t, validateTime)(data.toTime)

    if (data.fromTime && !data.toTime) {
        res.toTime = t('EventEdit.fillBothTimes')
    }

    if (!data.fromTime && data.toTime) {
        res.fromTime = t('EventEdit.fillBothTimes')
    }

    if (!res.fromDate && !res.toDate) {
        // Check date relationship
        const from = data.fromDate?.getTime() || 0
        const to = data.toDate?.getTime() || 0

        if (to < from) {
            res.toDate = t('EventEdit.dateMismatch')
        }
        if (to === from && data.fromTime && data.toTime && !res.fromTime && !res.toTime) {
            if (parseMinutes(data.fromTime || '') >= parseMinutes(data.toTime || '')) {
                res.toTime = t('EventEdit.timeMismatch')
            }
        }
    }

    return res
}

export const createInputFromValues = (data: FormValues): CreateEventInput => ({
    name: data.name,
    fromDate: buildDateTime(data.fromDate, data.fromTime),
    toDate: buildDateTime(data.toDate, data.toTime),
    amountOfPlayers: data.amountOfPlayers ? parseInt(data.amountOfPlayers, 10) : undefined,
    web: data.web,
    loc: data.loc,
    description: editorStateToHtml(data.description),
    games: data.games.map(({ id }) => id),
    labels: [...data.requiredLabels, ...data.optionalLabels],
    newLabels: data.newLabels,
})

const dateTimeRe = /^([-0-9]+)T([0-9]+:[0-9]+):/
const parseDateTime = (dateTime: string | undefined | null) => {
    if (!dateTime) {
        return undefined
    }

    return dateTimeRe.exec(dateTime)
}

const getDate = (dateTime: string | undefined | null) => {
    const match = parseDateTime(dateTime)
    if (!match) {
        return undefined
    }

    return new Date(match[1])
}

const getTime = (dateTime: string | undefined | null) => {
    const match = parseDateTime(dateTime)
    if (!match) {
        return undefined
    }

    return match[2]
}

type LoadedEvent = Pick<Event, 'id' | 'name' | 'from' | 'to' | 'amountOfPlayers' | 'web' | 'loc' | 'description'> & {
    games?: Maybe<Array<Pick<Game, 'id' | 'name' | 'year'>>>
    labels?: Maybe<Array<Pick<Label, 'id' | 'name' | 'description' | 'isRequired'>>>
}

export const toInitialValues = (event: LoadedEvent): FormValues => ({
    name: event.name ?? '',
    fromDate: getDate(event.from),
    fromTime: getTime(event.from),
    toDate: getDate(event.to),
    toTime: getTime(event.to),
    amountOfPlayers: event.amountOfPlayers?.toString(),
    web: event.web ?? undefined,
    loc: event.loc ?? '',
    description: event.description ?? undefined,
    games: (event.games ?? []).map(({ id, name, year }) => ({
        id,
        name: name ?? '',
        itemLabel: createGameLabel({ name, year }),
    })),
    requiredLabels: (event.labels ?? []).filter(({ isRequired }) => isRequired).map(({ id }) => id),
    optionalLabels: (event.labels ?? []).filter(({ isRequired }) => !isRequired).map(({ id }) => id),
    newLabels: [],
})

export const emptyInitialValues: FormValues = {
    name: '',
    loc: '',
    games: [],
    requiredLabels: [],
    optionalLabels: [],
    newLabels: [],
}
