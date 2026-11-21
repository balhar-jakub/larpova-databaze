import React, { useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { DocumentNode } from 'graphql'
import { createUseStyles } from 'react-jss'
import { darkTheme } from '../../theme/darkTheme'
import { GameCatalogOrder } from '../../graphql/__generated__/typescript-operations'
import * as familyGamesDocument from './graphql/familyGames.graphql'
import * as familyEventsDocument from './graphql/familyEvents.graphql'
import * as familySeriesDocument from './graphql/familySeriesGames.graphql'
import * as topFamilySeriesDocument from './graphql/topFamilySeries.graphql'
import * as seriesCommentsDocument from './graphql/seriesComments.graphql'
import {
    FamilyGamesQuery,
    FamilyGamesQueryVariables,
    FamilyEventsQuery,
    FamilyEventsQueryVariables,
    FamilySeriesGamesQuery,
    FamilySeriesGamesQueryVariables,
    TopFamilySeriesQuery,
    TopFamilySeriesQueryVariables,
    SeriesCommentsQuery,
    SeriesCommentsQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import { GameRatingBox } from '../common/GameRatingBox/GameRatingBox'
import { GameLink } from '../common/GameLink/GameLink'
import { sanitizeHtml } from '../../utils/sanitizeHtml'
import UserLink from '../common/UserLink/UserLink'

const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const familyGamesGql = documentOf(familyGamesDocument)
const familyEventsGql = documentOf(familyEventsDocument)
const familySeriesGql = documentOf(familySeriesDocument)
const topFamilySeriesGql = documentOf(topFamilySeriesDocument)
const seriesCommentsGql = documentOf(seriesCommentsDocument)

type FamilyGamesQueryData = NonNullable<FamilyGamesQuery['games']>['catalog']
type FamilyEvent = NonNullable<FamilyEventsQuery['eventCalendar']>['events'][number]
type FamilyGame = FamilyGamesQueryData['games'][number]
type SeriesDetail = NonNullable<FamilySeriesGamesQuery['seriesById']>
type TopSeries = NonNullable<TopFamilySeriesQuery['games']>['topFamilySeries']['series'][number]
type SeriesComment = NonNullable<SeriesCommentsQuery['seriesComments']>['comments'][number]

const PAGE_SIZE = 12
const FETCH_POLICY = 'network-only' as const
const todayIso = () => new Date().toISOString().slice(0, 10)

const useStyles = createUseStyles({
    wrap: {
        maxWidth: 1110,
        margin: '0 auto',
        padding: '24px 34px 60px',
    },
    hero: {
        background: `linear-gradient(135deg, ${darkTheme.backgroundLight}, ${darkTheme.backgroundHover})`,
        border: `1px solid ${darkTheme.backgroundControl}`,
        borderRadius: 12,
        padding: '22px 24px',
        marginBottom: 18,
    },
    h1: {
        color: darkTheme.textLight,
        fontSize: '1.6rem',
        fontWeight: 600,
        margin: '0 0 6px',
    },
    lead: {
        color: darkTheme.text,
        fontSize: '0.9rem',
        lineHeight: 1.5,
        maxWidth: 780,
    },
    chips: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 14,
    },
    chip: {
        background: darkTheme.backgroundControl,
        color: darkTheme.backgroundAlmostNearWhite,
        border: `1px solid ${darkTheme.backgroundControl}`,
        borderRadius: 20,
        padding: '7px 14px',
        fontSize: '0.82rem',
        cursor: 'pointer',
        '&$on': {
            background: darkTheme.red,
            borderColor: darkTheme.red,
            color: '#fff',
        },
    },
    on: {},
    kpis: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 18,
    },
    kpi: {
        background: darkTheme.backgroundLight,
        border: `1px solid ${darkTheme.backgroundControl}`,
        borderRadius: 10,
        padding: '14px 16px',
    },
    kpiValue: { color: darkTheme.textLight, fontSize: '1.5rem', fontWeight: 700 },
    kpiKey: { color: darkTheme.textLighter, fontSize: '0.78rem', marginTop: 2, lineHeight: 1.4 },
    panel: {
        background: darkTheme.backgroundWhite,
        borderRadius: 12,
        padding: '20px 22px',
        marginBottom: 18,
        color: darkTheme.textOnLightDark,
    },
    panelTitle: { fontSize: '1.1rem', color: '#333', margin: '0 0 2px' },
    panelNote: { fontSize: '0.8rem', color: darkTheme.textOnLightLighter, marginBottom: 14, lineHeight: 1.45 },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 14,
    },
    card: {
        background: darkTheme.backgroundRealWhite,
        border: `1px solid ${darkTheme.backgroundNearWhite}`,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
    },
    cover: {
        position: 'relative',
        paddingTop: '56.25%',
        backgroundColor: darkTheme.backgroundNearWhite,
    },
    coverImage: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
    rating: { position: 'absolute', top: 8, right: 8 },
    kidsBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(39, 39, 39, 0.85)',
        color: '#fff',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: '0.68rem',
        fontWeight: 600,
    },
    body: { padding: '10px 12px 12px', flex: 1 },
    name: { margin: '0 0 4px', fontSize: '0.95rem', '& a': { color: darkTheme.textGreenDark } },
    meta: { fontSize: '0.7rem', color: darkTheme.textOnLightLighter, marginBottom: 6 },
    seriesLink: {
        fontSize: '0.7rem',
        color: darkTheme.textGreenDark,
        cursor: 'pointer',
        textDecoration: 'underline',
    },
    pill: { fontSize: '0.68rem', fontWeight: 600, borderRadius: 20, padding: '3px 10px', display: 'inline-block' },
    open: { background: '#e2f3ee', color: '#0b7a66' },
    closed: { background: '#f6dfe0', color: '#8c2430' },
    upcoming: { background: '#e3edf7', color: '#2f5d8a' },
    none: { background: '#ececec', color: '#777' },
    loading: { color: darkTheme.textLighter, padding: '20px 0' },
    seriesDrawer: {
        marginTop: 14,
        borderTop: `1px solid ${darkTheme.backgroundNearWhite}`,
        paddingTop: 12,
    },
    topList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    topRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 10px',
        borderRadius: 8,
        background: darkTheme.backgroundRealWhite,
        border: `1px solid ${darkTheme.backgroundNearWhite}`,
        cursor: 'pointer',
        '&:hover': { borderColor: darkTheme.textGreen },
    },
    topRank: {
        fontSize: '1.1rem',
        fontWeight: 800,
        color: darkTheme.textGreenDark,
        minWidth: 30,
        textAlign: 'center',
    },
    topBody: { flex: 1, minWidth: 0 },
    topName: { fontWeight: 600, fontSize: '0.92rem', color: darkTheme.textOnLightDark },
    topMeta: { fontSize: '0.72rem', color: darkTheme.textOnLightLighter, marginTop: 2 },
    reviewItem: {
        borderTop: `1px solid ${darkTheme.backgroundNearWhite}`,
        padding: '10px 4px',
        fontSize: '0.85rem',
        lineHeight: 1.5,
    },
    reviewHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: '0.75rem',
        color: darkTheme.textOnLightLighter,
        marginBottom: 4,
        flexWrap: 'wrap',
    },
    yearTag: {
        background: darkTheme.backgroundNearWhite,
        borderRadius: 4,
        padding: '1px 7px',
        fontWeight: 600,
        color: darkTheme.textOnLightDark,
    },
    kidsTag: {
        background: '#e2f3ee',
        color: '#0b7a66',
        borderRadius: 10,
        padding: '1px 8px',
        fontWeight: 700,
        fontSize: '0.68rem',
    },
    reviewHtml: { color: darkTheme.textOnLightDark, '& p': { margin: '0 0 6px' } },
    seriesRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 4px',
        fontSize: '0.82rem',
        borderBottom: `1px solid ${darkTheme.backgroundNearWhite}`,
        '& a': { color: darkTheme.textOnLightDark, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    },
    seriesYear: { color: darkTheme.textOnLightLighter, fontSize: '0.75rem', minWidth: 38 },
})

const fmtDate = (ms?: string | null) => {
    if (!ms) return ''
    const d = new Date(Number(ms))
    return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`
}

const durationOf = (g: { hours?: number | null; days?: number | null }) => {
    if (g.days) return `${g.days} dny`
    if (g.hours) return `${g.hours} h`
    return '—'
}

type ChipKey = 'family' | 'kidsReviews' | 'small' | 'oneDay' | 'noAction'

const FamilyKidsPanel = () => {
    const classes = useStyles()
    const client = useApolloClient()
    const [chips, setChips] = useState<Record<ChipKey, boolean>>({
        family: true,
        kidsReviews: false,
        small: false,
        oneDay: false,
        noAction: false,
    })
    const [games, setGames] = useState<FamilyGamesQueryData | null>(null)
    const [events, setEvents] = useState<FamilyEventsQuery['eventCalendar'] | null>(null)
    const [series, setSeries] = useState<SeriesDetail | null>(null)
    const [seriesReviews, setSeriesReviews] = useState<SeriesComment[] | null>(null)
    const [topSeries, setTopSeries] = useState<TopSeries[] | null>(null)
    const [loading, setLoading] = useState(true)

    const toggle = (key: ChipKey) => setChips((c) => ({ ...c, [key]: !c[key] }))

    React.useEffect(() => {
        let cancelled = false
        setLoading(true)
        const filter: FamilyGamesQueryVariables['filter'] = {
            familyKeywords: chips.family || undefined,
            withKidsReviews: chips.kidsReviews || undefined,
            playersTo: chips.small ? 15 : undefined,
            durations: chips.oneDay ? ['short', 'day'] : undefined,
            noLabels: chips.noAction ? ['10', '21', '32', '9', '166', '1151'] : undefined,
            minRatings: 0,
        }
        Promise.all([
            client.query<FamilyGamesQuery, FamilyGamesQueryVariables>({
                query: familyGamesGql,
                variables: { filter, order: GameCatalogOrder.Recommended, offset: 0, limit: PAGE_SIZE },
                fetchPolicy: FETCH_POLICY,
            }),
            client.query<FamilyEventsQuery, FamilyEventsQueryVariables>({
                query: familyEventsGql,
                variables: { from: todayIso(), kidsProgram: true, offset: 0, limit: 30 },
                fetchPolicy: FETCH_POLICY,
            }),
        ])
            .then(([g, e]) => {
                if (cancelled) return
                setGames(g.data.games.catalog)
                setEvents(e.data.eventCalendar)
                setLoading(false)
            })
            .catch(() => {
                if (cancelled) return
                setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [chips, client])

    // TOP žebříček: rodinné série řazené podle série-celkového (bayes) hodnocení.
    React.useEffect(() => {
        let cancelled = false
        client
            .query<TopFamilySeriesQuery, TopFamilySeriesQueryVariables>({
                query: topFamilySeriesGql,
                variables: { filter: { familyKeywords: true }, offset: 0, limit: 10 },
                fetchPolicy: FETCH_POLICY,
            })
            .then((r) => {
                if (!cancelled) setTopSeries(r.data.games.topFamilySeries.series)
            })
            .catch(() => undefined)
        return () => {
            cancelled = true
        }
    }, [client])

    const loadSeries = (seriesId: string, name: string | null) => {
        setSeriesReviews(null)
        client
            .query<FamilySeriesGamesQuery, FamilySeriesGamesQueryVariables>({
                query: familySeriesGql,
                variables: { seriesId },
                fetchPolicy: FETCH_POLICY,
            })
            .then((r) => setSeries(r.data.seriesById))
            .catch(() => setSeries({ id: seriesId, name, games: [] } as unknown as SeriesDetail))
        // Jedním tahem i všechny recenze série (nejnovější první, každá se značkou ročníku).
        client
            .query<SeriesCommentsQuery, SeriesCommentsQueryVariables>({
                query: seriesCommentsGql,
                variables: { seriesId, offset: 0, limit: 30 },
                fetchPolicy: FETCH_POLICY,
            })
            .then((r) => setSeriesReviews(r.data.seriesComments.comments))
            .catch(() => setSeriesReviews([]))
    }

    const registrationPill = (e: FamilyEvent) => {
        switch (e.registrationStatus) {
            case 'OPEN':
                return <span className={`${classes.pill} ${classes.open}`}>přihláška otevřená</span>
            case 'CLOSED':
                return <span className={`${classes.pill} ${classes.closed}`}>přihláška uzavřená</span>
            case 'UPCOMING':
                return <span className={`${classes.pill} ${classes.upcoming}`}>přihláška se otevře</span>
            default:
                return <span className={`${classes.pill} ${classes.none}`}>bez přihlášky v DB</span>
        }
    }

    const coverOfEvent = (e: FamilyEvent) => {
        for (const g of e.games ?? []) {
            if (g.coverImage?.id) return `/game-image/?id=${g.id}&imageId=${g.coverImage.id}`
        }
        if (e.coverImage?.id) return `/game-image/?id=${e.id}&imageId=${e.coverImage.id}`
        return undefined
    }

    const kpiTotal = games?.totalAmount ?? 0

    return (
        <div className={classes.wrap}>
            <div className={classes.hero}>
                <h1 className={classes.h1}>Larp pro děti a rodiny</h1>
                <p className={classes.lead}>
                    Výběr larpů a akcí vhodných pro děti — ne samostatný web, ale pohled nad katalogem:
                    stejné karty her, jen s filtry, které dávají smysl rodičům. Recenze se u každé hry dají
                    označit jako „hodnocení dětského programu“, takže poznáš, jestli šlo o plnohodnotný program,
                    nebo jen hlídání dětí v kostýmech.
                </p>
                <div className={classes.chips}>
                    {(
                        [
                            ['family', 'Zmínka děti/rodina/věk v popisu'],
                            ['kidsReviews', 'S hodnocením dětského programu'],
                            ['small', 'Malá skupina (do 15 hráčů)'],
                            ['oneDay', 'Jeden den'],
                            ['noAction', 'Bez akčních/hororových prvků'],
                        ] as [ChipKey, string][]
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            className={`${classes.chip} ${chips[key] ? classes.on : ''}`}
                            onClick={() => toggle(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={classes.kpis}>
                <div className={classes.kpi}>
                    <div className={classes.kpiValue}>{kpiTotal}</div>
                    <div className={classes.kpiKey}>larpů odpovídá aktuálním filtrům</div>
                </div>
                <div className={classes.kpi}>
                    <div className={classes.kpiValue}>{events?.totalAmount ?? 0}</div>
                    <div className={classes.kpiKey}>nadcházejících akcí s dětským/rodinným programem</div>
                </div>
                <div className={classes.kpi}>
                    <div className={classes.kpiValue}>{series?.amountOfGames ?? '—'}</div>
                    <div className={classes.kpiKey}>
                        {series ? `dílů série „${series.name}“ — recenze se počítají přes celou sérii` : 'seriózní larp = série běhů, recenze celkem'}
                    </div>
                </div>
            </div>

            <div className={classes.panel}>
                <h2 className={classes.panelTitle}>Larpy vhodné pro děti</h2>
                <p className={classes.panelNote}>
                    Řazeno podle doporučení komunity. Kliknutím na sérii uvidíš všechny její běhy najednou —
                    recenze a hodnocení jsou u série celkově, ne po jednotlivých ročnících.
                </p>
                {loading && <div className={classes.loading}>Načítám…</div>}
                <div className={classes.grid}>
                    {(games?.games ?? []).map((g: FamilyGame) => (
                        <article key={g.id} className={classes.card}>
                            <div className={classes.cover}>
                                {g.coverImage?.id && (
                                    <img
                                        className={classes.coverImage}
                                        src={`/game-image/?id=${g.id}&imageId=${g.coverImage.id}`}
                                        alt=""
                                        loading="lazy"
                                    />
                                )}
                                <GameRatingBox
                                    className={classes.rating}
                                    amountOfRatings={g.amountOfRatings}
                                    averageRating={g.averageRating}
                                    onPhoto
                                    size="small"
                                />
                            </div>
                            <div className={classes.body}>
                                <h3 className={classes.name}>
                                    <GameLink game={{ id: g.id, name: g.name }} />
                                </h3>
                                <div className={classes.meta}>
                                    {g.year ? `${g.year} · ` : ''}
                                    {g.players ? `${g.players} hráčů · ` : ''}
                                    {durationOf(g)}
                                </div>
                                {g.series?.id && (
                                    <span
                                        className={classes.seriesLink}
                                        onClick={() => loadSeries(g.series!.id, g.series!.name)}
                                        title="Zobrazit všechny běhy série s celkovými recenzemi"
                                    >
                                        série: {g.series.name} »
                                    </span>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
                {series && (
                    <div className={classes.seriesDrawer}>
                        <h2 className={classes.panelTitle}>
                            Série „{series.name}“ — {series.amountOfGames} běhů, {series.amountOfRatings} hlasů,{' '}
                            {series.amountOfComments} recenzí celkem
                        </h2>
                        <p className={classes.panelNote}>
                            {series.firstYear ? `${series.firstYear}–${series.lastYear ?? series.firstYear}` : ''} ·
                            kliknutím na běh otevřeš detail hry
                        </p>
                        {(series.games ?? []).map((g) => (
                            <div key={g.id} className={classes.seriesRow}>
                                <span className={classes.seriesYear}>{g.year ?? '—'}</span>
                                <GameLink game={{ id: g.id, name: g.name }} />
                                <span>{g.players ? `${g.players} hráčů` : ''}</span>
                                <GameRatingBox
                                    amountOfRatings={g.amountOfRatings}
                                    averageRating={g.averageRating}
                                    size="small"
                                />
                            </div>
                        ))}
                        <h3 className={classes.panelTitle} style={{ marginTop: 16 }}>
                            Všechny recenze série najednou (nejnovější první, každá se značkou ročníku)
                        </h3>
                        {(seriesReviews ?? []).map((c) => (
                            <div key={c.id} className={classes.reviewItem}>
                                <div className={classes.reviewHead}>
                                    <UserLink userId={c.user.id}>{c.user.nickname ?? c.user.name}</UserLink>
                                    {c.added && <span>{new Date(Number(c.added)).toLocaleDateString('cs-CZ')}</span>}
                                    {c.game?.year != null && <span className={classes.yearTag}>ročník {c.game.year}</span>}
                                    {c.game?.id && (
                                        <GameLink game={{ id: c.game.id, name: c.game.name ?? undefined }} />
                                    )}
                                    {c.kidsReview && <span className={classes.kidsTag}>recenze dětského programu</span>}
                                </div>
                                <div
                                    className={classes.reviewHtml}
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.comment ?? '') }}
                                />
                            </div>
                        ))}
                        {seriesReviews && seriesReviews.length === 0 && (
                            <p className={classes.panelNote}>Tato série zatím nemá žádné recenze.</p>
                        )}
                    </div>
                )}
            </div>

            <div className={classes.panel}>
                <h2 className={classes.panelTitle}>Žebříček TOP larpů pro děti</h2>
                <p className={classes.panelNote}>
                    Série, jejichž hry jsou vhodné pro děti, seřazené podle celkového hodnocení napříč všemi
                    ročníky (vážený průměr — jeden 10/10 ročník nepřeváží osvědčenou klasiku s mnoha hlasy).
                </p>
                <div className={classes.topList}>
                    {(topSeries ?? []).map((s, i) => (
                        <div
                            key={s.id}
                            className={classes.topRow}
                            onClick={() => loadSeries(s.id, s.name)}
                            title="Otevřít sérii se všemi běhy a recenzemi"
                        >
                            <span className={classes.topRank}>{i + 1}.</span>
                            <div className={classes.topBody}>
                                <div className={classes.topName}>{s.name}</div>
                                <div className={classes.topMeta}>
                                    {s.amountOfGames} běhů · {s.amountOfRatings} hlasů · {s.amountOfComments} recenzí
                                    {s.firstYear ? ` · ${s.firstYear}–${s.lastYear ?? s.firstYear}` : ''}
                                </div>
                            </div>
                            <GameRatingBox
                                amountOfRatings={s.amountOfRatings}
                                averageRating={s.averageRating}
                                size="small"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className={classes.panel}>
                <h2 className={classes.panelTitle}>Nadcházející akce s dětským programem</h2>
                <p className={classes.panelNote}>
                    Akce, u kterých pořadatel vyznačil dětský/rodinný program (ne jen běžný larp). Tábory jsou
                    v kalendáři přes štítek/hledání „tábor“.
                </p>
                {loading && <div className={classes.loading}>Načítám…</div>}
                <div className={classes.grid}>
                    {(events?.events ?? []).map((e) => {
                        const cover = coverOfEvent(e)
                        return (
                            <article key={e.id} className={classes.card}>
                                <div className={classes.cover}>
                                    {cover && <img className={classes.coverImage} src={cover} alt="" loading="lazy" />}
                                    <span className={classes.kidsBadge}>dětský program</span>
                                </div>
                                <div className={classes.body}>
                                    <h3 className={classes.name}>{e.name}</h3>
                                    <div className={classes.meta}>
                                        {fmtDate(e.from)} · {e.loc ?? ''} · {e.amountOfPlayers ?? '?'} míst
                                    </div>
                                    <div className={classes.meta}>
                                        {(e.games ?? []).map((g) => g.name).join(', ') || '—'}
                                    </div>
                                    <div>{registrationPill(e)}</div>
                                </div>
                            </article>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default FamilyKidsPanel
