import React, { useEffect, useMemo, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { useApolloClient } from '@apollo/client'
import { DocumentNode } from 'graphql'
import { useRouter } from 'next/router'
import { ParsedUrlQuery } from 'querystring'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { breakPoints } from '../../theme/breakPoints'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import BigLoading from '../common/BigLoading/BigLoading'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'
import {
    CatalogGameDataFragment,
    CatalogGamesQuery,
    CatalogGamesQueryVariables,
    CatalogMoreGamesQuery,
    CatalogMoreGamesQueryVariables,
    GameCatalogOrder,
} from '../../graphql/__generated__/typescript-operations'
import CatalogGameCard from './CatalogGameCard'
import CatalogFilterPanel, { CatalogFacetsData } from './CatalogFilterPanel'
import {
    CATALOG_ORDERS,
    CATALOG_PRESETS,
    CatalogActiveFilter,
    CatalogState,
    catalogActiveFilterText,
    catalogActiveFilters,
    catalogStateKey,
    catalogStateToFilter,
    catalogStateToQuery,
    clearCatalogFilters,
    hasCatalogFilters,
    isPresetActive,
    parseCatalogState,
    presetPatch,
    togglePreset,
} from './catalogState'
import { componentTestIds } from '../componentTestIds'

import * as catalogGamesDocument from './graphql/catalogGames.graphql'
import * as catalogMoreGamesDocument from './graphql/catalogMoreGames.graphql'

// The webpack loader exports the document as CommonJS, an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const catalogGamesGql = documentOf(catalogGamesDocument)
const catalogMoreGamesGql = documentOf(catalogMoreGamesDocument)

interface Props {
    readonly initialQuery: ParsedUrlQuery
}

const PAGE_SIZES = [24, 48, 96]

interface CatalogPage {
    readonly games: CatalogGameDataFragment[]
    readonly totalAmount: number
    readonly facets: CatalogFacetsData
}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0 40px',
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
        marginBottom: 12,
        fontSize: '0.8rem',
        color: darkTheme.textOnLightLighter,
    },
    presets: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    preset: {
        padding: '4px 12px',
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 14,
        backgroundColor: darkTheme.backgroundRealWhite,
        color: darkTheme.textOnLight,
        fontSize: '0.75rem',
        cursor: 'pointer',
    },
    presetActive: {
        borderColor: darkTheme.textGreenDark,
        backgroundColor: darkTheme.textGreenDark,
        color: darkTheme.backgroundRealWhite,
        fontWeight: 700,
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 12,
    },
    select: {
        padding: '5px 8px',
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 3,
        backgroundColor: darkTheme.backgroundRealWhite,
        color: darkTheme.textOnLight,
        fontSize: '0.75rem',
    },
    count: {
        fontSize: '0.75rem',
        color: darkTheme.textOnLight,
    },
    chips: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 9px',
        border: 0,
        borderRadius: 12,
        backgroundColor: darkTheme.backgroundAlmostNearWhite2,
        color: darkTheme.textOnLight,
        fontSize: '0.7rem',
        cursor: 'pointer',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 14,
    },
    empty: {
        padding: 30,
        backgroundColor: darkTheme.backgroundRealWhite,
        borderRadius: 5,
        textAlign: 'center',
        color: darkTheme.textOnLight,
    },
    more: {
        marginTop: 18,
        textAlign: 'center',
    },
    moreButton: {
        padding: '10px 22px',
        border: 0,
        borderRadius: 4,
        backgroundColor: darkTheme.textGreenDark,
        color: darkTheme.backgroundRealWhite,
        fontWeight: 700,
        fontSize: '0.8rem',
        cursor: 'pointer',
    },
    [`@media(max-width: ${breakPoints.md - 1}px)`]: {
        grid: {
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        },
    },
})

/**
 * The games catalog: one list with filters, an order and facets, replacing the
 * five near-identical ladder tabs that used to live at /games. The filters live
 * in the URL, the list grows with "load more" instead of a pager (a pager over
 * 61 pages of the same top games was what made the old page useless), and the
 * facets come from the server so the counts always match the current filter.
 */
const CatalogPanel = ({ initialQuery }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const router = useRouter()
    const client = useApolloClient()

    const [state, setState] = useState<CatalogState>(() => parseCatalogState(initialQuery))
    const [page, setPage] = useState<CatalogPage | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)

    const stateKey = catalogStateKey(state)

    // The URL is the source of truth for shared links and the back button.
    useEffect(() => {
        const fromUrl = parseCatalogState(router.query)
        setState((current) => (catalogStateKey(fromUrl) === catalogStateKey(current) ? current : fromUrl))
    }, [router.query])

    useEffect(() => {
        let cancelled = false
        setLoading(true)

        client
            .query<CatalogGamesQuery, CatalogGamesQueryVariables>({
                query: catalogGamesGql,
                // `stateKey` covers every field of the state, so the effect can
                // depend on it alone.
                variables: {
                    filter: catalogStateToFilter(state),
                    order: state.order,
                    offset: 0,
                    limit: state.size,
                },
                fetchPolicy: 'cache-first',
            })
            .then((response) => {
                if (cancelled) return
                const catalog = response.data.games.catalog
                setPage({
                    games: catalog.games,
                    totalAmount: catalog.totalAmount,
                    facets: catalog.facets,
                })
                setLoading(false)
            })
            .catch(() => {
                if (cancelled) return
                setPage(undefined)
                setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [stateKey])

    const commitState = (next: CatalogState) => {
        setState(next)
        router.replace({ pathname: router.pathname, query: catalogStateToQuery(next) }, undefined, {
            shallow: true,
        })
    }

    const updateState = (patch: Partial<CatalogState>) => commitState({ ...state, ...patch })

    const handleLoadMore = () => {
        if (!page || loadingMore) return

        setLoadingMore(true)
        client
            .query<CatalogMoreGamesQuery, CatalogMoreGamesQueryVariables>({
                query: catalogMoreGamesGql,
                variables: {
                    filter: catalogStateToFilter(state),
                    order: state.order,
                    offset: page.games.length,
                    limit: state.size,
                },
                fetchPolicy: 'network-only',
            })
            .then((response) => {
                const more = response.data.games.catalog.games
                setPage({ ...page, games: [...page.games, ...more] })
            })
            .finally(() => setLoadingMore(false))
    }

    const labelNames = useMemo(
        () =>
            (page?.facets.labels ?? []).reduce<{ [id: string]: string }>((map, label) => {
                map[label.id] = label.name ?? label.id
                return map
            }, {}),
        [page?.facets],
    )

    const labelIdsByName = useMemo(
        () =>
            (page?.facets.labels ?? []).reduce<{ [name: string]: string }>((map, label) => {
                if (label.name) map[label.name] = label.id
                return map
            }, {}),
        [page?.facets],
    )

    const activeFilters = catalogActiveFilters(state, labelNames)


    const games = page?.games ?? []
    const remaining = page ? Math.max(0, page.totalAmount - games.length) : 0

    return (
        <>
            <OpenGraphMeta title={t('Catalog.pageTitle')} description={t('Catalog.pageDescription')} />
            <div className={classes.row} data-testid={componentTestIds.catalog.panel}>
                <WidthFixer className={loading ? classes.loading : undefined}>
                    <h1 className={classes.title}>{t('Catalog.pageTitle')}</h1>
                    <div className={classes.subtitle}>
                        {page
                            ? t('Catalog.subtitle', { count: page.totalAmount })
                            : t('Catalog.subtitleLoading')}
                    </div>

                    <div className={classes.presets}>
                        {CATALOG_PRESETS.map((preset) => {
                            if (!presetPatch(preset, labelIdsByName)) return null
                            const active = isPresetActive(preset, state, labelIdsByName)

                            return (
                                <button
                                    type="button"
                                    key={preset.key}
                                    className={`${classes.preset} ${active ? classes.presetActive : ''}`}
                                    onClick={() => commitState(togglePreset(preset, state, labelIdsByName))}
                                >
                                    {t(preset.textKey)}
                                </button>
                            )
                        })}
                    </div>

                    <Row>
                        <Col lg={3} md={4} xs={12}>
                            <CatalogFilterPanel
                                state={state}
                                facets={page?.facets}
                                onStateChange={updateState}
                                onReset={() => commitState(clearCatalogFilters(state))}
                            />
                        </Col>
                        <Col lg={9} md={8} xs={12}>
                            <div className={classes.toolbar}>
                                <label>
                                    <span className={classes.count}>{`${t('Catalog.order.label')} `}</span>
                                    <select
                                        className={classes.select}
                                        value={state.order}
                                        onChange={(event) =>
                                            updateState({
                                                order: event.target.value as GameCatalogOrder,
                                                addedWithinDays: undefined,
                                            })
                                        }
                                    >
                                        {CATALOG_ORDERS.map((order) => (
                                            <option key={order} value={order}>
                                                {t(`Catalog.order.${order}`)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <span className={classes.count}>{`${t('Catalog.size.label')} `}</span>
                                    <select
                                        className={classes.select}
                                        value={state.size}
                                        onChange={(event) => updateState({ size: Number(event.target.value) })}
                                    >
                                        {PAGE_SIZES.map((size) => (
                                            <option key={size} value={size}>
                                                {t('Catalog.size.option', { count: size })}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <span className={classes.count} data-testid={componentTestIds.catalog.resultCount}>
                                    {t('Catalog.resultCount', { count: page?.totalAmount ?? 0 })}
                                </span>
                                <div className={classes.chips} data-testid={componentTestIds.catalog.activeFilters}>
                                    {activeFilters.map((filter) => (
                                        <button
                                            type="button"
                                            key={filter.key}
                                            className={classes.chip}
                                            onClick={() => updateState(filter.remove)}
                                        >
                                            {catalogActiveFilterText(filter, t)}
                                            <span aria-hidden="true">✕</span>
                                        </button>
                                    ))}
                                    {hasCatalogFilters(state) && (
                                        <button
                                            type="button"
                                            className={classes.chip}
                                            onClick={() => commitState(clearCatalogFilters(state))}
                                        >
                                            {t('Catalog.resetAll')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!page && <BigLoading />}

                            {page && games.length === 0 && (
                                <div className={classes.empty} data-testid={componentTestIds.catalog.empty}>
                                    {t('Catalog.empty')}
                                    <div>
                                        <button
                                            type="button"
                                            className={classes.moreButton}
                                            onClick={() => commitState(clearCatalogFilters(state))}
                                        >
                                            {t('Catalog.reset')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {games.length > 0 && (
                                <div className={classes.grid}>
                                    {games.map((game) => (
                                        <CatalogGameCard key={game.id} game={game} />
                                    ))}
                                </div>
                            )}

                            {remaining > 0 && (
                                <div className={classes.more}>
                                    <button
                                        type="button"
                                        className={classes.moreButton}
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                        data-testid={componentTestIds.catalog.loadMore}
                                    >
                                        {loadingMore
                                            ? t('Catalog.loading')
                                            : t('Catalog.loadMore', {
                                                  count: Math.min(state.size, remaining),
                                                  remaining,
                                              })}
                                    </button>
                                </div>
                            )}
                        </Col>
                    </Row>
                </WidthFixer>
            </div>
        </>
    )
}

export default CatalogPanel
