import React, { useEffect, useMemo, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useMutation, useQuery } from '@apollo/client'
import { useTranslation } from 'react-i18next'
import { Col, Row } from 'react-bootstrap'
import classNames from 'classnames'
import isInBrowser from 'is-in-browser'
import { darkTheme } from '../../theme/darkTheme'
import {
    DeleteEventMutation,
    DeleteEventMutationVariables,
    LoadEventQuery,
    LoadEventQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import DetailGameList from '../common/DetailGameList/DetailGameList'
import { formatTimeRange } from '../../utils/dateUtils'
import DetailLabelList from '../common/DetailLabelList/DetailLabelList'
import ActionButton from '../common/ActionButton/ActionButton'
import { useRoutes } from '../../hooks/useRoutes'
import ConfirmationModal from '../common/ConfirmationModal/ConfirmationModal'
import { canDelete, canEdit } from '../../utils/graphqlUtils'
import { useShowToast } from '../../hooks/useShowToast'
import { sanitizeHtml } from '../../utils/sanitizeHtml'
import { breakPoints } from '../../theme/breakPoints'
import { htmlToText } from '../../utils/textUtils'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'

const loadEventGql = require('./graphql/loadEvent.graphql')
const deleteEventGql = require('./graphql/deleteEvent.graphql')

interface Props {
    readonly eventId: string
}

const useStyles = createUseStyles({
    headerWrapper: {
        backgroundColor: darkTheme.background,
        padding: '20px 0',
        minHeight: 200,
    },
    header: {
        fontSize: '1.75rem',
        fontWeight: 'bold',
        color: darkTheme.textGreen,
        lineHeight: '100%',
        marginBottom: '1rem',
    },
    text: {
        fontSize: '0.75rem',
        color: darkTheme.textLighter,
        marginBottom: '0.6rem',
    },
    description: {
        maxWidth: 675,
        lineHeight: '135%',
    },
    labelsWrapper: {
        margin: '20px 0 15px',
    },
    gamesWrapper: {
        backgroundColor: darkTheme.backgroundNearWhite,
        minHeight: 200,
        paddingTop: 20,
        paddingBottom: 20,
    },
    link: {
        color: darkTheme.textGreen,

        '&:hover': {
            color: darkTheme.text,
        },
    },
    hideUpToMd: {
        display: 'none',
    },
    [`@media(min-width: ${breakPoints.md}px)`]: {
        hideUpToMd: {
            display: 'initial',
        },
    },
})

const EventDetailPanel = ({ eventId }: Props) => {
    const classes = useStyles()
    const routes = useRoutes()
    const [deleteConfirmShown, setDeleteConfirmShown] = useState(false)
    const { t } = useTranslation('common')
    const { data } = useQuery<LoadEventQuery, LoadEventQueryVariables>(loadEventGql, {
        ssr: true,
        fetchPolicy: isInBrowser ? 'cache-and-network' : 'cache-first',
        nextFetchPolicy: 'network-only',
        variables: { eventId },
    })
    const [deleteEvent, { loading: deleteLoading }] = useMutation<DeleteEventMutation, DeleteEventMutationVariables>(
        deleteEventGql,
    )
    const showToast = useShowToast()
    const event = data?.eventById
    const games = event?.games || []
    const labels = event?.labels || []
    const { fromFormatted, toFormatted, justOneDate } = formatTimeRange(event?.from, event?.to)
    const editVisible = canEdit(event?.allowedActions)
    const deleteVisible = canDelete(event?.allowedActions)
    const description = event?.description

    // Sanitized needs browser so we sanitize description after first render
    const [sanitizedDescription, setSanitizedDescription] = useState('')
    useEffect(() => {
        setSanitizedDescription(sanitizeHtml(description))
    }, [description])

    const handleEditEvent = () => {
        routes.push(routes.eventEdit(eventId))
    }
    const handleDeleteEvent = () => {
        setDeleteConfirmShown(true)
    }

    const handleHideDeleteModal = () => setDeleteConfirmShown(false)

    const handleDoDeleteEvent = () => {
        deleteEvent({ variables: { eventId } }).then(res => {
            if (res.data) {
                setDeleteConfirmShown(false)
                showToast(t('EventDetail.eventDeleted'), 'success')
                routes.push(routes.homepage())
            }
        })
    }

    const textDescription = useMemo(() => htmlToText(description).substring(0, 300), [description])

    const amountOfPlayers = event?.amountOfPlayers

    return (
        <>
            <div className={classes.headerWrapper}>
                <OpenGraphMeta title={event?.name ?? ''} description={textDescription} />
                <WidthFixer>
                    {event && (
                        <>
                            <h1 className={classes.header}>{event.name}</h1>
                            {typeof amountOfPlayers === 'number' && (
                                <div className={classes.text}>
                                    {t('EventDetail.players', { count: amountOfPlayers })}
                                </div>
                            )}
                            {event.web && (
                                <div className={classes.text}>
                                    <strong>{t('Event.web')}: </strong>
                                    <a href={event.web} className={classes.link} target="_blank" rel="noreferrer">
                                        {event.web}
                                    </a>
                                </div>
                            )}
                            {event.loc && (
                                <div className={classes.text}>
                                    <strong>{t('Event.loc')}: </strong>
                                    {event.loc}
                                </div>
                            )}
                            <div className={classes.text}>
                                <strong>{t('EventDetail.date')}: </strong>
                                {justOneDate && fromFormatted}
                                {!justOneDate && (
                                    <>
                                        {fromFormatted}
                                        &nbsp;-&nbsp;
                                        {toFormatted}
                                    </>
                                )}
                            </div>
                            {event.description && (
                                <div
                                    className={classNames(classes.text, classes.description)}
                                    /* eslint-disable-next-line react/no-danger */
                                    dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                                />
                            )}
                            <div className={classes.labelsWrapper}>
                                <DetailLabelList labels={labels} linkType="events" />
                            </div>
                        </>
                    )}
                </WidthFixer>
            </div>
            <div className={classes.gamesWrapper}>
                <WidthFixer>
                    {event && (
                        <Row>
                            <Col md={9} className={games.length === 0 ? 'd-none d-md-block' : undefined}>
                                <DetailGameList games={games} />
                            </Col>
                            <Col md={3}>
                                {editVisible && (
                                    <ActionButton onClick={handleEditEvent}>{t('EventDetail.edit')}</ActionButton>
                                )}
                                {deleteVisible && (
                                    <ActionButton onClick={handleDeleteEvent}>{t('EventDetail.delete')}</ActionButton>
                                )}
                            </Col>
                        </Row>
                    )}
                </WidthFixer>
            </div>
            <ConfirmationModal
                show={deleteConfirmShown}
                content={t('EventDetail.deleteEventConfirmation')}
                loading={deleteLoading}
                onHide={handleHideDeleteModal}
                onCancel={handleHideDeleteModal}
                onConfirm={handleDoDeleteEvent}
            />
        </>
    )
}

export default EventDetailPanel
