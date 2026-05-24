import React, { useMemo, useState, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { createUseStyles } from 'react-jss'
import { useApolloClient, useQuery } from '@apollo/client'
import { Form as FinalForm } from 'react-final-form'
import { Col, Row } from 'react-bootstrap'
import isInBrowser from 'is-in-browser'
import { darkTheme } from '../../theme/darkTheme'
import {
    CalendarEventDataFragment,
    LoadCalendarEventsQuery,
    LoadCalendarEventsQueryVariables,
    MoreCalendarEventsQuery,
    MoreCalendarEventsQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import { LabelFromGql } from '../common/LabelsEditColumn/LabelsEditColumn'
import { labelMapper } from '../../hooks/usePredefinedLabels'
import { TabDefinition, Tabs } from '../common/Tabs/Tabs'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import Pager from '../common/Pager/Pager'
import LabelFilterFields from '../common/LabelFilterFields/LabelFilterFields'
import CalendarEventPanel from './CalendarEventPanel'
import { formSectionHeaderStyles, formSectionHeaderStylesMd } from '../../utils/formClasses'
import BigLoading from '../common/BigLoading/BigLoading'
import FormDateInputField from '../common/form/FormDateInputField'
import { formatISODate, parseDateTime } from '../../utils/dateUtils'
import { breakPoints } from '../../theme/breakPoints'
import { MonthSeparator } from './MonthSeparator'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'

const loadCalendarEventsGql = require('./graphql/loadCalendarEvents.graphql')
const moreCalendarEventsGql = require('./graphql/moreCalendarEvents.graphql')

interface Props {
    readonly initialRequiredLabelIds?: string[]
    readonly initialOptionalLabelIds?: string[]
}

interface FormValues {
    from: Date
    to?: Date
    requiredLabels: string[]
    optionalLabels: string[]
}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0',
    },
    loading: {
        opacity: 0.5,
    },
    ...formSectionHeaderStyles,
    labelsCol: {
        padding: '0 15px',
    },
    [`@media(min-width: ${breakPoints.md}px)`]: formSectionHeaderStylesMd,
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        labelsCol: {
            padding: '0 30px',
            marginTop: 16,
        },
    },
    iCal: {
        backgroundColor: darkTheme.backgroundRealWhite,
        fontStyle: 'italic',
        textAlign: 'center',
        padding: 20,
        borderRadius: 4,
        marginBottom: 20,
        '& a': {
            fontWeight: 'bold',
        },
    },
})

const PAGE_SIZE = 100

type Page = Partial<{
    events: CalendarEventDataFragment[]
    totalAmount: number
}>

const tabs: Array<TabDefinition<number>> = [
    {
        key: 0,
        title: { key: 'EventCalendar.events' },
    },
]

const EventCalendarListPanel = ({ initialRequiredLabelIds, initialOptionalLabelIds }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [offset, setOffset] = useState(0)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState<Page>({})
    const [requiredLabels, setRequiredLabels] = useState<LabelFromGql[] | undefined>(undefined)
    const [optionalLabels, setOptionalLabels] = useState<LabelFromGql[] | undefined>(undefined)
    const client = useApolloClient()
    const initialValues = useMemo(() => {
        const now = new Date()
        return {
            from: now,
            requiredLabels: initialRequiredLabelIds || [],
            optionalLabels: initialOptionalLabelIds || [],
        } as FormValues
    }, [initialRequiredLabelIds, initialOptionalLabelIds])

    useQuery<LoadCalendarEventsQuery, LoadCalendarEventsQueryVariables>(loadCalendarEventsGql, {
        variables: {
            from: formatISODate(initialValues.from),
            requiredLabels: initialRequiredLabelIds,
            optionalLabels: initialOptionalLabelIds,
            offset: 0,
            limit: PAGE_SIZE,
        },
        ssr: false,
        skip: !isInBrowser,
        fetchPolicy: 'cache-and-network',
        nextFetchPolicy: 'cache-first', // Do not reload on page change
        onCompleted: response => {
            setLoading(false)
            setPage(response?.eventCalendar || [])
            setRequiredLabels(response?.authorizedRequiredLabels?.map(labelMapper))
            setOptionalLabels(response?.authorizedOptionalLabels?.map(labelMapper))
        },
    })

    const { events } = page
    let currentMonth = ''

    return (
        <>
            <OpenGraphMeta
                title={t('EventCalendar.pageTitle')}
                description={t('EventCalendar.pageDescription')}
                image="/images/lk-logo.png"
            />
            <FinalForm<FormValues> initialValues={initialValues} onSubmit={() => {}}>
                {({ values }) => {
                    const refreshList = ({
                        newOffset,
                        newFrom,
                        newTo,
                        newRequiredLabels,
                        newOptionalLabels,
                    }: {
                        newOffset?: number
                        newFrom?: Date
                        newTo?: Date
                        newRequiredLabels?: string[]
                        newOptionalLabels?: string[]
                    }) => {
                        setLoading(true)
                        client
                            .query<MoreCalendarEventsQuery, MoreCalendarEventsQueryVariables>({
                                query: moreCalendarEventsGql,
                                fetchPolicy: 'network-only',
                                variables: {
                                    from: formatISODate(newFrom || values.from),
                                    to: formatISODate(newTo || values.to),
                                    offset: newOffset !== undefined ? newOffset : offset,
                                    limit: PAGE_SIZE,
                                    requiredLabels: newRequiredLabels || values.requiredLabels,
                                    optionalLabels: newOptionalLabels || values.optionalLabels,
                                },
                            })
                            .then(response => {
                                setPage(response.data.eventCalendar)
                                setLoading(false)
                            })
                    }

                    const handleOffsetChanged = (newOffset: number) => {
                        setOffset(newOffset)
                        refreshList({ newOffset })
                    }

                    const handleFromChanged = (newValue?: Date) => {
                        refreshList({ newFrom: newValue })
                    }

                    const handleToChanged = (newValue?: Date) => {
                        refreshList({ newTo: newValue })
                    }

                    return (
                        <>
                            <Tabs<number> tabs={tabs} selectedTab={0} />
                            <div className={classes.row}>
                                {(!events || !requiredLabels || !optionalLabels) && <BigLoading />}
                                {events && requiredLabels && optionalLabels && (
                                    <WidthFixer className={loading ? classes.loading : undefined}>
                                        <div className={classes.iCal}>
                                            <a href={t('EventCalendar.gCalUrl')} target="_blank" rel="noreferrer">
                                                {t('EventCalendar.gCalLink')}
                                            </a>
                                            {t('EventCalendar.gCalText')}
                                        </div>
                                        <Row>
                                            <Col md={9}>
                                                {events.map(event => {
                                                    const lastMonth = currentMonth
                                                    const parsedDate = parseDateTime(event.from)
                                                    currentMonth = parsedDate
                                                        ? parsedDate.toLocaleString('cs-CZ', {
                                                              month: 'long',
                                                              year: 'numeric',
                                                          })
                                                        : '???'
                                                    return (
                                                        <Fragment key={event.id}>
                                                            {currentMonth !== lastMonth && (
                                                                <MonthSeparator>{currentMonth}</MonthSeparator>
                                                            )}
                                                            <CalendarEventPanel event={event} />
                                                        </Fragment>
                                                    )
                                                })}
                                                <Pager
                                                    currentOffset={offset}
                                                    pageSize={PAGE_SIZE}
                                                    totalAmount={page.totalAmount ?? 0}
                                                    onOffsetChanged={handleOffsetChanged}
                                                />
                                            </Col>
                                            <Col md={3} className={classes.labelsCol}>
                                                <header className={classes.header}>
                                                    {t('EventCalendar.eventFrom')}
                                                </header>
                                                <FormDateInputField
                                                    name="from"
                                                    showErrorPlaceholder={false}
                                                    onChange={handleFromChanged}
                                                />
                                                <header className={classes.header}>{t('EventCalendar.eventTo')}</header>
                                                <FormDateInputField
                                                    name="to"
                                                    showErrorPlaceholder={false}
                                                    onChange={handleToChanged}
                                                />
                                                <LabelFilterFields
                                                    requiredLabelList={requiredLabels}
                                                    optionalLabelList={optionalLabels}
                                                    onSelectionChanged={refreshList}
                                                />
                                            </Col>
                                        </Row>
                                    </WidthFixer>
                                )}
                            </div>
                        </>
                    )
                }}
            </FinalForm>
        </>
    )
}

export default EventCalendarListPanel
