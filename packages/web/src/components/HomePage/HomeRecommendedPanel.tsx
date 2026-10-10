import React from 'react'
import { createUseStyles } from 'react-jss'
import { Col } from 'react-bootstrap'
import { format } from 'date-fns-tz'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { parseDateTime } from '../../utils/dateUtils'
import { GameBaseData } from '../common/GameBaseDataPanel/GameBaseDataPanel'
import { GameLink } from '../common/GameLink/GameLink'
import { GridHeader } from './GridHeader'
import { breakPoints } from '../../theme/breakPoints'

/** One signable event recommended by the visitor's taste labels. */
export interface RecommendedEvent {
    readonly id: string
    readonly name?: string | null
    readonly from?: string | null
    readonly to?: string | null
    readonly loc?: string | null
    readonly registrationUrl?: string | null
    readonly registrationOpen?: boolean | null
    readonly matchedLabels?: readonly string[] | null
    readonly games?: readonly (GameBaseData | undefined)[] | null
}

interface Props {
    readonly events?: RecommendedEvent[]
}

const useStyles = createUseStyles({
    note: {
        color: darkTheme.textDark,
        fontSize: '0.65rem',
        fontWeight: 400,
        textTransform: 'none',
        marginLeft: 6,
        // On a narrow screen the long note wraps under the title instead of
        // squeezing it; then it needs its own line of room above the rows.
        [`@media(max-width: ${breakPoints.md - 1}px)`]: {
            flexBasis: '100%',
            marginLeft: 0,
            marginTop: 4,
            textAlign: 'center',
        },
    },
    event: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backgroundColor: darkTheme.backgroundLight,
        borderRadius: 4,
        padding: '12px 14px',
        marginBottom: 8,
    },
    body: {
        flexGrow: 1,
        minWidth: 0,
    },
    name: {
        color: darkTheme.text,
        fontSize: '0.8rem',
        fontWeight: 700,
    },
    meta: {
        color: darkTheme.textDark,
        fontSize: '0.7rem',
        marginTop: 2,
    },
    match: {
        color: darkTheme.textGreen,
        fontSize: '0.68rem',
        marginTop: 3,
    },
    dateBlock: {
        backgroundColor: darkTheme.red,
        color: darkTheme.textLight,
        borderRadius: 4,
        padding: '6px 10px',
        textAlign: 'center',
        flexShrink: 0,
        alignSelf: 'flex-start',
    },
    dateDay: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.1,
    },
    dateMonth: {
        fontSize: '0.6rem',
        textTransform: 'uppercase',
    },
    button: {
        display: 'inline-block',
        backgroundColor: darkTheme.red,
        color: darkTheme.textLight,
        borderRadius: 4,
        padding: '7px 12px',
        fontSize: '0.7rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        '&:hover': {
            backgroundColor: darkTheme.redLight,
            color: darkTheme.textLight,
        },
    },
    none: {
        color: darkTheme.textDark,
        fontSize: '0.78rem',
        textAlign: 'center',
        padding: '10px 0',
    },
})

/**
 * The recommendation a signed-in visitor can act on: future events with an
 * open registration whose game shares taste labels with the games they rated
 * 8 or more (the same taste set the old "Doporučeno podle štítků" was built
 * from, so the chips keep explaining a surprising row). Every row carries the
 * "shoda" line and ends with the signup button — a recommendation you cannot
 * sign up for is just a catalog row, which is what the block it replaced was.
 */
export const HomeRecommendedPanel = ({ events = [] }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <Col xl={12}>
            <GridHeader>
                {t('HomePage.recommended')}
                <span className={classes.note}>{t('HomePage.recommendedNote')}</span>
            </GridHeader>
            {events.length === 0 && <div className={classes.none}>{t('HomePage.recommendedNone')}</div>}
            {events.map((event) => {
                const from = event.from ? parseDateTime(event.from) : null
                const game = event.games?.[0]
                return (
                    <div className={classes.event} key={event.id}>
                        {from && (
                            <div className={classes.dateBlock}>
                                <div className={classes.dateDay}>{format(from || 0, 'dd')}</div>
                                <div className={classes.dateMonth}>{format(from || 0, 'MM')}</div>
                            </div>
                        )}
                        <div className={classes.body}>
                            {game && (
                                <GameLink game={game} className={classes.name}>{event.name}</GameLink>
                            )}
                            <div className={classes.meta}>
                                {event.from ? format(parseDateTime(event.from) || 0, 'dd.MM.yyyy') : ''}
                                {event.to ? ` – ${format(parseDateTime(event.to) || 0, 'dd.MM.yyyy')}` : ''}
                                {event.loc ? ` · ${event.loc}` : ''}
                            </div>
                            {event.matchedLabels && event.matchedLabels.length > 0 && (
                                <div className={classes.match}>
                                    {t('HomePage.recommendedMatch', {
                                        labels: event.matchedLabels.join(', '),
                                    })}
                                </div>
                            )}
                        </div>
                        {event.registrationUrl && (
                            <a className={classes.button} href={event.registrationUrl}>
                                {t('HomePage.recommendedSignUp')}
                            </a>
                        )}
                    </div>
                )
            })}
        </Col>
    )
}
