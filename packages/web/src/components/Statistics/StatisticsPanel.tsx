import React, { useEffect, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { DocumentNode } from 'graphql'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import BigLoading from '../common/BigLoading/BigLoading'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'
import { GameRatingBox } from '../common/GameRatingBox/GameRatingBox'
import { GameLink } from '../common/GameLink/GameLink'
import { componentTestIds } from '../componentTestIds'
import { StatisticsPageQuery } from '../../graphql/__generated__/typescript-operations'

import * as statisticsDocument from './graphql/statisticsPage.graphql'

// The webpack loader exports the document as CommonJS; an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const statisticsGql = documentOf(statisticsDocument)

type StatisticsData = StatisticsPageQuery['statistics']
type StatsYearRow = StatisticsData['years'][number]
type TopGameRow = StatsYearRow['topGames'][number]

/** Band colours best-first, mirroring `darkTheme`'s recommendation levels. */
const BAND_COLORS = [
    darkTheme.ratingStronglyRecommended,
    darkTheme.ratingRecommended,
    darkTheme.ratingNeutral,
    darkTheme.ratingNotRecommended,
    darkTheme.ratingStronglyNotRecommended,
]

/** Vote pairs, best first — numbers only, so no translation is needed. */
const BAND_LABELS = ['9–10', '7–8', '5–6', '3–4', '1–2']

const fmt = (n: number) => new Intl.NumberFormat('cs-CZ').format(n)

interface Props {}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0 40px',
        minHeight: '60vh',
    },
    loading: {
        opacity: 0.5,
    },
    title: {
        margin: '0 0 4px',
        fontSize: '1.6rem',
        color: darkTheme.textOnLightDark,
    },
    subtitle: {
        fontSize: '0.78rem',
        color: darkTheme.textOnLightLighter,
        maxWidth: 620,
        margin: '0 0 18px',
    },
    kpis: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10,
        margin: '0 0 26px',
    },
    kpi: {
        backgroundColor: darkTheme.backgroundAlmostNearWhite2,
        borderRadius: 5,
        padding: '12px 14px',
    },
    kpiValue: {
        fontSize: '1.4rem',
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
        fontVariantNumeric: 'tabular-nums',
    },
    kpiLabel: {
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    },
    section: {
        margin: '26px 0',
    },
    sectionTitle: {
        margin: '0 0 2px',
        fontSize: '1.1rem',
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
    },
    sectionSubtitle: {
        fontSize: '0.75rem',
        color: darkTheme.textOnLightLighter,
        margin: '0 0 10px',
        maxWidth: 640,
    },
    chart: {
        width: '100%',
        height: 'auto',
        display: 'block',
    },
    axisLabel: {
        fontSize: '11px',
        fill: darkTheme.textOnLightLighter,
        fontFamily: 'system-ui, sans-serif',
    },
    legend: {
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        fontSize: '0.72rem',
        color: darkTheme.textOnLight,
        marginTop: 6,
    },
    legendItem: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
    },
    swatch: {
        width: 11,
        height: 11,
        borderRadius: 2,
        display: 'inline-block',
    },
    grid2: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
    },
    tops: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 12,
    },
    topCol: {
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 5,
        padding: '10px 12px',
    },
    topColTitle: {
        margin: '0 0 6px',
        fontSize: '0.85rem',
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
    },
    topRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 0',
        borderTop: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
    },
    topName: {
        flex: 1,
        minWidth: 100,
        fontSize: '0.8rem',
    },
    topLink: {
        color: darkTheme.textGreenDark,
        '&:hover': {
            color: darkTheme.textOnLightDark,
        },
    },
    topVotes: {
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
    },
    notes: {
        borderTop: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        marginTop: 30,
        paddingTop: 12,
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
        lineHeight: 1.6,
        '& summary': {
            cursor: 'pointer',
            color: darkTheme.textOnLight,
            fontWeight: 600,
            marginBottom: 6,
        },
        '& ul': {
            margin: 0,
            paddingLeft: 18,
        },
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        grid2: {
            gridTemplateColumns: '1fr',
        },
    },
})

/** A number for the y axis rounded up to a pleasing step. */
const niceMax = (max: number) => {
    if (max <= 10) return 10
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / (magnitude / 2)) * (magnitude / 2)
}

/** Grouped bars: unique (green) in front, raw (grey) behind, per year. */
const EventsChart: React.FC<{ years: StatsYearRow[]; classes: Record<string, string> }> = ({ years, classes }) => {
    const W = 1040
    const H = 240
    const PAD_L = 46
    const PAD_B = 24
    const PAD_T = 12
    const max = niceMax(Math.max(...years.map((y) => y.eventsRaw), 10))
    const x = (i: number) => PAD_L + (i * (W - PAD_L - 10)) / Math.max(years.length - 1, 1)
    const y = (v: number) => H - PAD_B - (v * (H - PAD_B - PAD_T)) / max
    const bw = ((W - PAD_L - 10) / Math.max(years.length, 1)) * 0.55
    const ticks = 4
    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className={classes.chart}
            data-testid={componentTestIds.statistics.eventsChart}
            role="img"
        >
            {Array.from({ length: ticks + 1 }, (_, i) => {
                const v = (max / ticks) * i
                return (
                    <g key={i}>
                        <line x1={PAD_L} y1={y(v)} x2={W - 8} y2={y(v)} stroke={darkTheme.backgroundAlmostNearWhite} strokeWidth={1} />
                        <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" className={classes.axisLabel}>
                            {fmt(v)}
                        </text>
                    </g>
                )
            })}
            {years.map((yr, i) => (
                <g key={yr.year}>
                    {yr.eventsRaw > yr.events && (
                        <rect
                            x={x(i) - bw / 2}
                            y={y(yr.eventsRaw)}
                            width={bw}
                            height={y(0) - y(yr.eventsRaw)}
                            fill={darkTheme.backgroundAlmostNearWhite2}
                            rx={2}
                        >
                            <title>{`${yr.year}: ${yr.eventsRaw}× ${'v kalendáři'}`}</title>
                        </rect>
                    )}
                    <rect x={x(i) - bw / 2} y={y(yr.events)} width={bw} height={y(0) - y(yr.events)} fill={darkTheme.textGreenDark} rx={2}>
                        <title>{`${yr.year}: ${yr.events}`}</title>
                    </rect>
                    <text x={x(i)} y={H - 6} textAnchor="middle" className={classes.axisLabel}>
                        {yr.year}
                    </text>
                </g>
            ))}
        </svg>
    )
}

/** 100 % stacked bands, best band on top. */
const BandsChart: React.FC<{ years: StatsYearRow[]; classes: Record<string, string> }> = ({ years, classes }) => {
    const W = 1040
    const H = 220
    const PAD_L = 46
    const PAD_B = 24
    const PAD_T = 8
    const rated = years.filter((y) => y.ratings > 0)
    const x = (i: number) => PAD_L + (i * (W - PAD_L - 10)) / Math.max(rated.length - 1, 1)
    const bw = ((W - PAD_L - 10) / Math.max(rated.length, 1)) * 0.6
    const areaH = H - PAD_B - PAD_T
    const y = (frac: number) => PAD_T + (1 - frac) * areaH
    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className={classes.chart}
            data-testid={componentTestIds.statistics.bandsChart}
            role="img"
        >
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                <g key={frac}>
                    <line x1={PAD_L} y1={y(frac)} x2={W - 8} y2={y(frac)} stroke={darkTheme.backgroundAlmostNearWhite} strokeWidth={1} />
                    <text x={PAD_L - 6} y={y(frac) + 4} textAnchor="end" className={classes.axisLabel}>
                        {Math.round(frac * 100)} %
                    </text>
                </g>
            ))}
            {rated.map((yr, i) => {
                let acc = 0
                return (
                    <g key={yr.year}>
                        {yr.bands.map((count, band) => {
                            const frac = count / yr.ratings
                            const top = acc
                            acc += frac
                            if (frac <= 0) return null
                            return (
                                <rect
                                    key={band}
                                    x={x(i) - bw / 2}
                                    y={y(acc)}
                                    width={bw}
                                    height={Math.max(y(top) - y(acc), 0.5)}
                                    fill={BAND_COLORS[band]}
                                >
                                    <title>{`${yr.year}: ${count} (${Math.round(frac * 100)} %)`}</title>
                                </rect>
                            )
                        })}
                        <text x={x(i)} y={H - 6} textAnchor="middle" className={classes.axisLabel}>
                            {yr.year}
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}

/** Line chart of the yearly average, on a fixed 7–9 window so the trend reads. */
const AverageChart: React.FC<{ years: StatsYearRow[]; classes: Record<string, string> }> = ({ years, classes }) => {
    const W = 520
    const H = 210
    const PAD_L = 40
    const PAD_B = 22
    const PAD_T = 10
    const rated = years.filter((y): y is StatsYearRow & { averageRating: number } => y.averageRating !== null)
    const ymin = 7.0
    const ymax = 9.0
    const x = (i: number) => PAD_L + (i * (W - PAD_L - 10)) / Math.max(rated.length - 1, 1)
    const y = (v: number) => H - PAD_B - ((v - ymin) * (H - PAD_B - PAD_T)) / (ymax - ymin)
    const points = rated.map((yr, i) => `${x(i)},${y(yr.averageRating)}`).join(' ')
    const area = `${PAD_L},${y(ymin)} ${points} ${x(rated.length - 1)},${y(ymin)}`
    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className={classes.chart}
            data-testid={componentTestIds.statistics.averageChart}
            role="img"
        >
            {[7.0, 7.5, 8.0, 8.5, 9.0].map((v) => (
                <g key={v}>
                    <line x1={PAD_L} y1={y(v)} x2={W - 8} y2={y(v)} stroke={darkTheme.backgroundAlmostNearWhite} strokeWidth={1} />
                    <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" className={classes.axisLabel}>
                        {v.toFixed(1)}
                    </text>
                </g>
            ))}
            {rated.length > 1 && <polygon points={area} fill={darkTheme.textGreenDark} opacity={0.12} />}
            {rated.length > 1 && (
                <polyline points={points} fill="none" stroke={darkTheme.textGreenDark} strokeWidth={2.5} strokeLinejoin="round" />
            )}
            {rated.map((yr, i) => (
                <circle key={yr.year} cx={x(i)} cy={y(yr.averageRating)} r={3.5} fill={darkTheme.textGreenDark}>
                    <title>{`${yr.year}: ${yr.averageRating.toFixed(2)}`}</title>
                </circle>
            ))}
            {rated.map((yr, i) => (
                <text key={`t${yr.year}`} x={x(i)} y={H - 6} textAnchor="middle" className={classes.axisLabel}>
                    {String(yr.year).slice(2)}
                </text>
            ))}
        </svg>
    )
}

/** Vote counts per year; the 2014 import drawn on top of the year's bar. */
const VotesChart: React.FC<{ years: StatsYearRow[]; classes: Record<string, string> }> = ({ years, classes }) => {
    const W = 520
    const H = 210
    const PAD_L = 46
    const PAD_B = 22
    const PAD_T = 10
    const rated = years.filter((y) => y.ratings > 0)
    const max = niceMax(Math.max(...rated.map((y) => y.ratings), 10))
    const x = (i: number) => PAD_L + (i * (W - PAD_L - 10)) / Math.max(rated.length - 1, 1)
    const y = (v: number) => H - PAD_B - (v * (H - PAD_B - PAD_T)) / max
    const bw = ((W - PAD_L - 10) / Math.max(rated.length, 1)) * 0.6
    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className={classes.chart}
            data-testid={componentTestIds.statistics.votesChart}
            role="img"
        >
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const v = frac * max
                return (
                    <g key={frac}>
                        <line x1={PAD_L} y1={y(v)} x2={W - 8} y2={y(v)} stroke={darkTheme.backgroundAlmostNearWhite} strokeWidth={1} />
                        <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" className={classes.axisLabel}>
                            {fmt(Math.round(v))}
                        </text>
                    </g>
                )
            })}
            {rated.map((yr, i) => (
                <g key={yr.year}>
                    <rect x={x(i) - bw / 2} y={y(yr.ratings)} width={bw} height={y(0) - y(yr.ratings)} fill={darkTheme.textGreenDark} rx={2}>
                        <title>{`${yr.year}: ${yr.ratings}`}</title>
                    </rect>
                    {yr.importedRatings > 0 && (
                        <rect
                            x={x(i) - bw / 2}
                            y={y(yr.ratings)}
                            width={bw}
                            height={y(0) - y(yr.importedRatings)}
                            fill={darkTheme.ratingNotRated}
                            rx={2}
                        >
                            <title>{`${yr.year}: import ${yr.importedRatings}`}</title>
                        </rect>
                    )}
                    <text x={x(i)} y={H - 6} textAnchor="middle" className={classes.axisLabel}>
                        {String(yr.year).slice(2)}
                    </text>
                </g>
            ))}
        </svg>
    )
}

/** New games per year, plain bars. */
const NewGamesChart: React.FC<{ years: StatsYearRow[]; classes: Record<string, string> }> = ({ years, classes }) => {
    const W = 1040
    const H = 220
    const PAD_L = 46
    const PAD_B = 24
    const PAD_T = 10
    const withGames = years.filter((y) => y.newGames > 0)
    const max = niceMax(Math.max(...withGames.map((y) => y.newGames), 10))
    const x = (i: number) => PAD_L + (i * (W - PAD_L - 10)) / Math.max(withGames.length - 1, 1)
    const y = (v: number) => H - PAD_B - (v * (H - PAD_B - PAD_T)) / max
    const bw = ((W - PAD_L - 10) / Math.max(withGames.length, 1)) * 0.6
    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className={classes.chart}
            data-testid={componentTestIds.statistics.newGamesChart}
            role="img"
        >
            {[0, 1, 2, 3, 4].map((i) => {
                const v = (max / 4) * i
                return (
                    <g key={i}>
                        <line x1={PAD_L} y1={y(v)} x2={W - 8} y2={y(v)} stroke={darkTheme.backgroundAlmostNearWhite} strokeWidth={1} />
                        <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" className={classes.axisLabel}>
                            {fmt(Math.round(v))}
                        </text>
                    </g>
                )
            })}
            {withGames.map((yr, i) => (
                <g key={yr.year}>
                    <rect x={x(i) - bw / 2} y={y(yr.newGames)} width={bw} height={y(0) - y(yr.newGames)} fill={darkTheme.textGreenDark} rx={2}>
                        <title>{`${yr.year}: ${yr.newGames}`}</title>
                    </rect>
                    <text x={x(i)} y={H - 6} textAnchor="middle" className={classes.axisLabel}>
                        {yr.year}
                    </text>
                </g>
            ))}
        </svg>
    )
}

/** One year's "Hry roku" card: badge in the site's own rating visual. */
const TopGameRowView: React.FC<{ entry: TopGameRow; classes: Record<string, string>; t: (k: string, v?: Record<string, number>) => string }> = ({ entry, classes, t }) => (
    <div className={classes.topRow}>
        <GameRatingBox
            rating={entry.averageInYear ?? undefined}
            averageRating={entry.game.averageRating}
            amountOfRatings={entry.game.amountOfRatings}
            size="small"
        />
        <span className={classes.topName}>
            <GameLink game={entry.game} className={classes.topLink}>
                {entry.game.name}
            </GameLink>
        </span>
        <span className={classes.topVotes}>{t('Statistics.topGameVotes', { count: entry.votesInYear })}</span>
    </div>
)

/**
 * The statistics page: how the scene and its ratings changed year by year.
 * One query feeds everything; the charts are inline SVG so the page carries no
 * chart library, and the data's honesty rules (unique events, the 2014 import)
 * are baked into the API, not re-derived here.
 */
const StatisticsPanel = (_props: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const client = useApolloClient()
    const [data, setData] = useState<StatisticsData | undefined>(undefined)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let cancelled = false
        client
            .query<StatisticsPageQuery>({ query: statisticsGql })
            .then((result) => {
                if (!cancelled) setData(result.data.statistics)
            })
            .catch(() => {
                if (!cancelled) setFailed(true)
            })
        return () => {
            cancelled = true
        }
    }, [client])

    const years = data?.years ?? []
    // "Hry roku" cards: the newest years the data has, like the mockup.
    const topYears = [...years].filter((y) => y.topGames.length > 0).slice(-5).reverse()

    return (
        <>
            <OpenGraphMeta
                title={t('Statistics.pageTitle')}
                description={t('Statistics.pageDescription')}
                image="/images/lk-logo.png"
            />
            <div className={classes.row} data-testid={componentTestIds.statistics.panel}>
                <WidthFixer className={!data ? classes.loading : undefined}>
                    <h1 className={classes.title}>{t('Statistics.pageTitle')}</h1>
                    <div className={classes.subtitle}>{t('Statistics.pageDescription')}</div>

                    {!data && !failed && <BigLoading />}
                    {failed && <div>{t('loadError')}</div>}

                    {data && (
                        <>
                            <div className={classes.kpis}>
                                <div className={classes.kpi}>
                                    <div className={classes.kpiValue}>{fmt(data.gamesTotal)}</div>
                                    <div className={classes.kpiLabel}>{t('Statistics.kpiGames')}</div>
                                </div>
                                <div className={classes.kpi}>
                                    <div className={classes.kpiValue}>{fmt(data.eventsTotal)}</div>
                                    <div className={classes.kpiLabel}>{t('Statistics.kpiEvents')}</div>
                                </div>
                                <div className={classes.kpi}>
                                    <div className={classes.kpiValue}>{fmt(data.ratingsTotal)}</div>
                                    <div className={classes.kpiLabel}>{t('Statistics.kpiRatings')}</div>
                                </div>
                                <div className={classes.kpi}>
                                    <div className={classes.kpiValue}>{fmt(data.commentsTotal)}</div>
                                    <div className={classes.kpiLabel}>{t('Statistics.kpiComments')}</div>
                                </div>
                            </div>

                            <section className={classes.section}>
                                <h2 className={classes.sectionTitle}>{t('Statistics.eventsTitle')}</h2>
                                <div className={classes.sectionSubtitle}>{t('Statistics.eventsSubtitle')}</div>
                                <EventsChart years={years} classes={classes} />
                                <div className={classes.legend}>
                                    <span className={classes.legendItem}>
                                        <span className={classes.swatch} style={{ backgroundColor: darkTheme.textGreenDark }} />
                                        {t('Statistics.eventsLegendUnique')}
                                    </span>
                                    <span className={classes.legendItem}>
                                        <span className={classes.swatch} style={{ backgroundColor: darkTheme.backgroundAlmostNearWhite2 }} />
                                        {t('Statistics.eventsLegendRaw')}
                                    </span>
                                </div>
                            </section>

                            <section className={classes.section}>
                                <h2 className={classes.sectionTitle}>{t('Statistics.ratingsTitle')}</h2>
                                <div className={classes.sectionSubtitle}>{t('Statistics.ratingsSubtitle')}</div>
                                <BandsChart years={years} classes={classes} />
                                <div className={classes.legend}>
                                    {BAND_LABELS.map((label, i) => (
                                        <span key={i} className={classes.legendItem}>
                                            <span className={classes.swatch} style={{ backgroundColor: BAND_COLORS[i] }} />
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            </section>

                            <section className={classes.section}>
                                <h2 className={classes.sectionTitle}>{t('Statistics.averageTitle')}</h2>
                                <div className={classes.sectionSubtitle}>{t('Statistics.averageSubtitle')}</div>
                                <div className={classes.grid2}>
                                    <div>
                                        <AverageChart years={years} classes={classes} />
                                    </div>
                                    <div>
                                        <VotesChart years={years} classes={classes} />
                                        <div className={classes.legend}>
                                            <span className={classes.legendItem}>
                                                <span className={classes.swatch} style={{ backgroundColor: darkTheme.textGreenDark }} />
                                                {t('Statistics.averageLegendVotes')}
                                            </span>
                                            <span className={classes.legendItem}>
                                                <span className={classes.swatch} style={{ backgroundColor: darkTheme.ratingNotRated }} />
                                                {t('Statistics.averageLegendImport')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {topYears.length > 0 && (
                                <section className={classes.section}>
                                    <h2 className={classes.sectionTitle}>{t('Statistics.topGamesTitle')}</h2>
                                    <div className={classes.sectionSubtitle}>{t('Statistics.topGamesSubtitle')}</div>
                                    <div className={classes.tops}>
                                        {topYears.map((yr) => (
                                            <div key={yr.year} className={classes.topCol} data-testid={componentTestIds.statistics.topGames(yr.year)}>
                                                <h3 className={classes.topColTitle}>{yr.year}</h3>
                                                {yr.topGames.map((entry) => (
                                                    <TopGameRowView key={entry.game.id} entry={entry} classes={classes} t={t} />
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section className={classes.section}>
                                <h2 className={classes.sectionTitle}>{t('Statistics.newGamesTitle')}</h2>
                                <div className={classes.sectionSubtitle}>{t('Statistics.newGamesSubtitle')}</div>
                                <NewGamesChart years={years} classes={classes} />
                            </section>

                            <details className={classes.notes} data-testid={componentTestIds.statistics.notes}>
                                <summary>{t('Statistics.notesTitle')}</summary>
                                <ul>
                                    <li>
                                        {t('Statistics.notes.events', {
                                            raw: years.reduce((sum, y) => sum + y.eventsRaw, 0),
                                            unique: data.eventsTotal,
                                        })}
                                    </li>
                                    {(years.find((y) => y.importedRatings > 0)?.importedRatings ?? 0) > 0 && (
                                        <li>
                                            {t('Statistics.notes.import', {
                                                count: fmt(years.find((y) => y.importedRatings > 0)?.importedRatings ?? 0),
                                            })}
                                        </li>
                                    )}
                                    <li>{t('Statistics.notes.live')}</li>
                                    <li>{t('Statistics.notes.topGames')}</li>
                                </ul>
                            </details>
                        </>
                    )}
                </WidthFixer>
            </div>
        </>
    )
}

export default StatisticsPanel
