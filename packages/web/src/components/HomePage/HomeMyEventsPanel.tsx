import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { EventBaseData } from './EventBaseDataPanel'
import { GameEventGrid } from './GameEventGrid'
import { GridHeader } from './GridHeader'

interface Props {
    readonly events?: Array<EventBaseData & {
        registrationUrl?: string | null
        registrationOpen?: boolean | null
    }>
    readonly wantedCount?: number
    readonly withoutEvent?: number
    readonly userId?: string
}

const useStyles = createUseStyles({
    note: {
        color: darkTheme.textDark,
        fontSize: '0.65rem',
        fontWeight: 400,
        textTransform: 'none',
        marginLeft: 6,
    },
    none: {
        color: darkTheme.textDark,
        fontSize: '0.78rem',
        textAlign: 'center',
        padding: '10px 0 0',
    },
    feed: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: darkTheme.backgroundLight,
        borderRadius: 4,
        padding: 16,
    },
    feedTitle: {
        color: darkTheme.text,
        fontSize: '0.82rem',
        fontWeight: 700,
        margin: '0 0 8px',
    },
    feedText: {
        color: darkTheme.textDark,
        fontSize: '0.72rem',
        margin: '0 0 12px',
    },
    feedLink: {
        alignSelf: 'flex-start',
        borderRadius: 4,
        padding: '8px 14px',
        fontSize: '0.72rem',
        color: darkTheme.textOnLightDark,
        backgroundColor: darkTheme.backgroundRealWhite,
        '&:hover': {
            backgroundColor: darkTheme.backgroundAlmostNearWhite,
            color: darkTheme.textOnLightDark,
        },
    },
})

/**
 * "Do not miss this": the events of the games the visitor wants to play, which
 * is the one block that can only exist for a signed-in visitor. It is the first
 * block of the page because it is the only one with a deadline — and the one
 * whose action leaves the site: an event with an open registration carries the
 * signup URL right in the query, so the card can offer it without a second
 * round trip (the signup button on the card renders from
 * `registrationOpen`/`registrationUrl`).
 *
 * Only 17 of 40 upcoming events are linked to a game at all, so most visitors
 * have nothing here — the feed card next to it is the way out for them, and it
 * stays visible whether or not any event matched.
 */
export const HomeMyEventsPanel = ({ events = [], wantedCount, withoutEvent, userId }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={12}>
            <GridHeader>
                {t('HomePage.myEvents')}
                <span className={classes.note}>{t('HomePage.myEventsNote')}</span>
            </GridHeader>
            <Row>
                <Col xl={8}>
                    {events.length > 0 ? (
                        <GameEventGrid elements={events} />
                    ) : (
                        <div className={classes.none}>{t('HomePage.myEventsNone')}</div>
                    )}
                </Col>
                <Col xl={4}>
                    <div className={classes.feed}>
                        <h3 className={classes.feedTitle}>{t('HomePage.myEventsFeedTitle')}</h3>
                        {wantedCount != null && withoutEvent != null && wantedCount > 0 && (
                            <p className={classes.feedText}>
                                {t('HomePage.myEventsFeedText', { missing: withoutEvent, total: wantedCount })}
                            </p>
                        )}
                        {userId && (
                            <a className={classes.feedLink} href={`/ical?id=${userId}`}>
                                {t('HomePage.myEventsFeedLink')}
                            </a>
                        )}
                    </div>
                </Col>
            </Row>
        </Col>
    )
}
