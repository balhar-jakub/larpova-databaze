import React from 'react'
import { createUseStyles } from 'react-jss'
import Link from 'next/link'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'

interface Props {
    readonly name?: string | null
    readonly userId?: string
    /** Missing while the personal query is still in flight — then it is not printed. */
    readonly playedCount?: number
    readonly authoredCount?: number
    readonly commentsCount?: number
    /** Games waiting for the visitor's voice: unplayed ratings and missing reviews. */
    readonly toFinishCount?: number
}

const useStyles = createUseStyles({
    band: {
        backgroundColor: darkTheme.background,
        padding: '30px 0 22px',
    },
    inner: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
    },
    title: {
        color: darkTheme.text,
        fontSize: '1.5rem',
        fontWeight: 700,
        margin: '0 0 10px',
    },
    larder: {
        display: 'block',
        color: darkTheme.textDark,
        fontSize: '0.85rem',
        fontWeight: 400,
        marginTop: 4,
    },
    numbers: {
        color: darkTheme.textDark,
        fontSize: '0.78rem',
        margin: '0 0 14px',
    },
    links: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    link: {
        borderRadius: 4,
        margin: '0 5px 8px',
        padding: '8px 16px',
        fontSize: '0.75rem',
        color: darkTheme.text,
        border: `1px solid ${darkTheme.backgroundControl}`,
        '&:hover': {
            backgroundColor: darkTheme.backgroundHover,
            color: darkTheme.text,
        },
    },
})

/**
 * The first thing a signed-in visitor reads: their own numbers and the two
 * places they lead. The anonymous hero's search box is not repeated here — the
 * header carries it on every page, and somebody who is signed in came for their
 * own list, not for a way into the database.
 */
export const HomePersonalPanel = ({ name, userId, playedCount, authoredCount, commentsCount, toFinishCount }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    // Czech needs a different form for 1, 2–4 and 5+, so each count is resolved
    // on its own and the line only joins finished phrases.
    const count = (key: string, value?: number) =>
        value == null ? null : t(`HomePage.${key}`, { count: value })
    const numbers = [
        count('personalPlayed', playedCount),
        count('personalAuthored', authoredCount),
        count('personalComments', commentsCount),
        toFinishCount != null && toFinishCount > 0
            ? t('HomePage.personalToFinish', { count: toFinishCount })
            : null,
    ].filter(Boolean) as string[]

    return (
        <div className={classes.band}>
            <WidthFixer className={classes.inner}>
                <h1 className={classes.title}>
                    {t('HomePage.personalHello', { name: name ?? '' })}
                    {playedCount != null && (
                        <span className={classes.larder}>
                            {t('HomePage.personalLarder', { games: count('personalPlayed', playedCount) })}
                        </span>
                    )}
                </h1>
                {numbers.length > 0 && <p className={classes.numbers}>{numbers.join(' · ')}</p>}
                <div className={classes.links}>
                    <Link href="/profile/current" legacyBehavior>
                        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a className={classes.link} href="/profile/current">{t('HomePage.personalProfile')}</a>
                    </Link>
                    {userId && (
                        <a className={classes.link} href={`/ical?id=${userId}`}>{t('HomePage.personalIcal')}</a>
                    )}
                </div>
            </WidthFixer>
        </div>
    )
}
