import React, { useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useRouter } from 'next/router'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'

export interface HomeStats {
    readonly games: number
    readonly events: number
    readonly upcomingEvents: number
    readonly users: number
    readonly labels: number
}

export interface HomeLabel {
    readonly id: string
    readonly name?: string | null
    readonly count: number
    readonly isRequired: boolean
}

interface Props {
    readonly stats?: HomeStats
    readonly labels?: HomeLabel[]
}

const useStyles = createUseStyles({
    hero: {
        backgroundColor: darkTheme.background,
        padding: '30px 0 25px',
    },
    inner: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    title: {
        color: darkTheme.text,
        fontSize: '1.6rem',
        fontWeight: 700,
        textAlign: 'center',
        margin: '0 0 8px',
    },
    stats: {
        color: darkTheme.textDark,
        fontSize: '0.8rem',
        textAlign: 'center',
        margin: '0 0 18px',
    },
    search: {
        display: 'flex',
        width: '100%',
        maxWidth: 620,
        marginBottom: 20,
    },
    input: {
        flexGrow: 1,
        minWidth: 0,
        border: 0,
        outline: 0,
        borderRadius: 4,
        padding: '11px 14px',
        fontSize: '0.85rem',
        color: darkTheme.textOnLight,
        backgroundColor: darkTheme.backgroundWhite,
    },
    searchButton: {
        border: 0,
        borderRadius: 4,
        marginLeft: 8,
        padding: '11px 22px',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: darkTheme.textOnLightDark,
        backgroundColor: darkTheme.backgroundRealWhite,
        '&:hover': {
            backgroundColor: darkTheme.backgroundAlmostNearWhite,
        },
    },
    labelsTitle: {
        color: darkTheme.textDark,
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    labels: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 900,
    },
    label: {
        border: 0,
        borderRadius: 14,
        cursor: 'pointer',
        margin: '0 4px 8px',
        padding: '5px 12px',
        fontSize: '0.72rem',
        color: darkTheme.text,
        backgroundColor: darkTheme.backgroundControl,
        '&:hover': {
            backgroundColor: darkTheme.backgroundHover,
        },
    },
    labelCount: {
        color: darkTheme.textDark,
        marginLeft: 4,
    },
    labelAll: {
        border: 0,
        cursor: 'pointer',
        margin: '0 4px 8px',
        padding: '5px 12px',
        fontSize: '0.72rem',
        color: darkTheme.textGreen,
        backgroundColor: 'transparent',
    },
})

/**
 * The first thing an anonymous visitor reads: what the database holds, where to
 * search and what to browse by. Before this the page opened with four unlabelled
 * numbers per game card and the only way into the catalog was the small box in
 * the header.
 */
export const HomeHeroPanel = ({ stats, labels = [] }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const router = useRouter()
    const [term, setTerm] = useState('')

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const query = term.trim()
        router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
    }

    return (
        <div className={classes.hero}>
            <WidthFixer className={classes.inner}>
                <h1 className={classes.title}>{t('HomePage.pageTitle')}</h1>
                {stats && (
                    <p className={classes.stats}>
                        {/* Czech needs a different form for 1, 2–4 and 5+, so every
                            count is resolved on its own and the sentence only
                            assembles the four finished phrases. */}
                        {t('HomePage.heroStats', {
                            games: t('HomePage.statGames', { count: stats.games }),
                            events: t('HomePage.statEvents', { count: stats.events }),
                            people: t('HomePage.statPeople', { count: stats.users }),
                            upcoming: t('HomePage.statUpcoming', { count: stats.upcomingEvents }),
                        })}
                    </p>
                )}
                <form className={classes.search} onSubmit={handleSubmit} role="search">
                    <input
                        className={classes.input}
                        type="search"
                        value={term}
                        onChange={(event) => setTerm(event.target.value)}
                        placeholder={t('HomePage.searchPlaceholder')}
                        aria-label={t('HomePage.searchPlaceholder')}
                    />
                    <button type="submit" className={classes.searchButton}>
                        {t('HomePage.searchButton')}
                    </button>
                </form>
                {labels.length > 0 && (
                    <>
                        <div className={classes.labelsTitle}>{t('HomePage.labelsTitle')}</div>
                        <div className={classes.labels}>
                            {labels.map((label) => (
                                <button
                                    type="button"
                                    key={label.id}
                                    className={classes.label}
                                    onClick={() => router.push(`/games?labels=${label.id}`)}
                                >
                                    {label.name}
                                    <span className={classes.labelCount}>{label.count}</span>
                                </button>
                            ))}
                            <button
                                type="button"
                                className={classes.labelAll}
                                onClick={() => router.push('/games')}
                            >
                                {t('HomePage.labelsMore')}
                            </button>
                        </div>
                    </>
                )}
            </WidthFixer>
        </div>
    )
}
