import { EditorState } from 'draft-js'
import { type Translator } from 'src/lib/i18n'
import { CreateEventInput, Event, Game, Label, Maybe } from '../../graphql/__generated__/typescript-operations'
import { editorStateToHtml } from '../common/form/richTextInputUtils'
import { createGameLabel, LinkedGame } from './GamesAutoCompleteField'
import { fieldValidator, validateRequired, validateTime } from '../../utils/validationUtils'
import { NewLabel } from '../common/form/NewLabelsField'
import { formatISODate } from '../../utils/dateUtils'
import { isAbsoluteHttpUrl } from '../../utils/urlUtils'
import { convertFileInput } from '../../utils/graphqlUtils'

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
    registrationUrl?: string
    registrationStatus: string
    registrationOpensDate?: Date
    registrationOpensTime?: string
    loc: string
    games: LinkedGame[]
    description?: string | EditorState
    coverImage?: string
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

export const validate = (t: Translator) => (data: FormValues) => {
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

    if (data.registrationStatus === 'OPEN' && !data.registrationUrl?.trim()) {
        res.registrationUrl = t('EventEdit.registrationUrlRequiredWhenOpen')
    } else if (data.registrationUrl && !isAbsoluteHttpUrl(data.registrationUrl)) {
        res.registrationUrl = t('Errors.invalidUrl')
    }

    return res
}

const buildOpensAtDateTime = (data: FormValues): string | undefined => {
    if (data.registrationStatus !== 'UPCOMING') {
        return undefined
    }

    return data.registrationOpensDate
        ? buildDateTime(data.registrationOpensDate, data.registrationOpensTime)
        : undefined
}

export const createInputFromValues = (data: FormValues): CreateEventInput => ({
    name: data.name,
    fromDate: buildDateTime(data.fromDate, data.fromTime),
    toDate: buildDateTime(data.toDate, data.toTime),
    amountOfPlayers: data.amountOfPlayers ? parseInt(data.amountOfPlayers, 10) : undefined,
    web: data.web,
    registrationUrl: data.registrationUrl,
    registrationStatus: (data.registrationStatus || undefined) as CreateEventInput['registrationStatus'],
    registrationOpensAt: buildOpensAtDateTime(data),
    loc: data.loc,
    description: editorStateToHtml(data.description),
    games: data.games.map(({ id }) => id),
    labels: [...data.requiredLabels, ...data.optionalLabels],
    newLabels: data.newLabels,
    coverImage: convertFileInput(data.coverImage),
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

type LoadedEvent = Pick<Event, 'id' | 'name' | 'from' | 'to' | 'amountOfPlayers' | 'web' | 'registrationUrl' | 'registrationStatus' | 'registrationOpensAt' | 'loc' | 'description'> & {
    games?: Maybe<Array<Pick<Game, 'id' | 'name' | 'year'>>>
    labels?: Maybe<Array<Pick<Label, 'id' | 'name' | 'description' | 'isRequired'>>>
}

const getOpensDate = (opensAt: string | null | undefined): Date | undefined => {
    const match = parseDateTime(opensAt)
    if (!match) {
        return undefined
    }

    return new Date(match[1])
}

const getOpensTime = (opensAt: string | null | undefined): string | undefined =>
    getTime(opensAt)

export const toInitialValues = (event: LoadedEvent): FormValues => ({
    name: event.name ?? '',
    fromDate: getDate(event.from),
    fromTime: getTime(event.from),
    toDate: getDate(event.to),
    toTime: getTime(event.to),
    amountOfPlayers: event.amountOfPlayers?.toString(),
    web: event.web ?? undefined,
    registrationUrl: event.registrationUrl ?? undefined,
    registrationStatus: event.registrationStatus ?? '',
    registrationOpensDate: getOpensDate(event.registrationOpensAt),
    registrationOpensTime: getOpensTime(event.registrationOpensAt),
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
    registrationStatus: '',
    loc: '',
    games: [],
    requiredLabels: [],
    optionalLabels: [],
    newLabels: [],
}
