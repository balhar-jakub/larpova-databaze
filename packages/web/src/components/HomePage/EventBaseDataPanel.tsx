import React from 'react'
import { Event } from 'src/graphql/__generated__/typescript-operations'
import { createUseStyles } from 'react-jss'
import classNames from 'classnames'
import { darkTheme } from '../../theme/darkTheme'
import { IconUser, IconLocation } from '../common/Icons/Icons'
import { formatTimeRange } from '../../utils/dateUtils'
import { useTranslation } from 'src/lib/i18n'
import EventLink from '../common/EventLink/EventLink'

export type EventBaseData = Pick<Event, 'id' | 'name' | 'from' | 'to' | 'amountOfPlayers' | 'loc'> & {
    registrationUrl?: string | null
    registrationOpen?: boolean | null
}

interface Props {
    readonly event?: EventBaseData
    readonly className?: string
}

const useStyles = createUseStyles({
    wrapper: {
        height: 70,
        display: 'flex',
        flexDirection: 'column',
        fontSize: '0.6rem',
        justifyContent: 'center',
        background: darkTheme.backgroundLight,
        borderRadius: 4,
        color: darkTheme.textDark,
        lineHeight: '170%',
        boxSizing: 'border-box',
        padding: '8px 15px',

        '&:hover': {
            backgroundColor: darkTheme.backgroundHover,
            color: darkTheme.textDark,
        },
    },
    name: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: '0.82rem',
        fontWeight: 700,
        color: darkTheme.textGreen,
        marginBottom: 3,
    },
    bottomLine: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        display: 'inline-block',
        textOverflow: 'ellipsis',
    },
    textByIcon: {
        margin: '0 8px 0 3px',
        whiteSpace: 'nowrap',
    },
    // An open registration is the one thing a card can offer without the
    // visitor reading anything else — the deadline, acted on. The button
    // replaces the location line, which is "-" half the time anyway.
    signUp: {
        alignSelf: 'flex-start',
        marginTop: 4,
        borderRadius: 4,
        padding: '4px 10px',
        fontSize: '0.68rem',
        fontWeight: 700,
        backgroundColor: darkTheme.red,
        color: darkTheme.textLight,
        whiteSpace: 'nowrap',
        '&:hover': {
            backgroundColor: darkTheme.redLight,
            color: darkTheme.textLight,
        },
    },
})

export const EventBaseDataPanel = ({ event, className }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    const { fromFormatted, toFormatted, justOneDate } = formatTimeRange(event?.from, event?.to)

    if (!event) {
        return <div className={classNames(classes.wrapper, className)} />
    }

    return (
        <EventLink event={event} className={classNames(classes.wrapper, className)}>
            <div className={classes.name}>{event.name}</div>
            <div>
                {justOneDate ? (
                    fromFormatted
                ) : (
                    <>
                        {fromFormatted}
                        &nbsp;-&nbsp;
                        {toFormatted}
                    </>
                )}
            </div>
            {event.registrationOpen && event.registrationUrl ? (
                <a
                    className={classes.signUp}
                    href={event.registrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                >
                    {t('HomePage.recommendedSignUp')}
                </a>
            ) : (
                <div className={classes.bottomLine}>
                    <IconUser />
                    <span className={classes.textByIcon}>{event.amountOfPlayers}</span>
                    <IconLocation />
                    <span className={classes.textByIcon}>{event.loc || '-'}</span>
                </div>
            )}
        </EventLink>
    )
}
