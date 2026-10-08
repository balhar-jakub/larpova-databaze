import React, { useEffect, useMemo, useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useQuery } from '@apollo/client'
import classNames from 'classnames'
import { useTranslation } from 'src/lib/i18n'
import {
    GameCatalogOrder,
    SearchPageGamesQuery,
    SearchPageGamesQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import Pager from '../common/Pager/Pager'
import CatalogFilterPanel, { CatalogOrderOption } from '../Catalog/CatalogFilterPanel'
import {
    CATALOG_PRESETS,
    CatalogState,
    catalogActiveFilterText,
    catalogActiveFilters,
    catalogStateKey,
    catalogStateToFilter,
    hasCatalogFilters,
    isPresetActive,
    presetPatch,
    togglePreset,
} from '../Catalog/catalogState'
import { darkTheme } from '../../theme/darkTheme'
import SearchGameRow from './SearchGameRow'
import { componentTestIds } from '../componentTestIds'
import type { DocumentNode } from 'graphql'

import * as searchGamesDocument from './graphql/searchPageGames.graphql'

// The webpack loader exports the document as CommonJS, an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const searchGamesGql = documentOf(searchGamesDocument)

type Page = SearchPageGamesQuery['games']['catalog']

/**
 * The rankings a search result offers. Relevance leads — it is what the search
 * engine itself ranks by and what the games section defaults to — and the rest
 * are the catalog's own rankings, so the list can be re-sorted in place.
 */
export const SEARCH_ORDER_OPTIONS: CatalogOrderOption[] = [
    { order: GameCatalogOrder.Relevance, textKey: 'Catalog.order.Relevance' },
    { order: GameCatalogOrder.Best, textKey: 'Catalog.order.Best' },
    { order: GameCatalogOrder.MostPlayed, textKey: 'Catalog.order.MostPlayed' },
    { order: GameCatalogOrder.Newest, textKey: 'Catalog.order.Newest' },
    { order: GameCatalogOrder.MostCommented, textKey: 'Catalog.order.MostCommented' },
    { order: GameCatalogOrder.NameAsc, textKey: 'Catalog.order.NameAsc' },
]

interface Props {
    readonly query: string
    /** The catalog state of this section — facets, ranking, page size; the search page owns it, it lives in the URL. */
    readonly state: CatalogState
    readonly onStateChange: (patch: Partial<CatalogState>) => void
    readonly onReset: () => void
}

/**
 * The search text is the page's own field (one query, one input), so a patch that
 * comes out of the presets must not carry it — a preset only moves the filters.
 */
const withoutQuery = (state: CatalogState): Partial<CatalogState> => {
    const { query: _query, ...rest } = state

    return rest
}

const useStyles = createUseStyles({
    heading: {
        fontSize: '0.85rem',
        padding: '0 0 10px',
    },
    toolbar: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        background: darkTheme.backgroundLight,
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 12,
    },
    order: {
        fontSize: '0.72rem',
        color: darkTheme.textDark,
        marginLeft: 'auto',
    },
    presets: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        border: `1px solid ${darkTheme.backgroundControl}`,
        background: darkTheme.background,
        color: darkTheme.text,
        borderRadius: 12,
        padding: '3px 12px',
        fontSize: '0.78rem',
        cursor: 'pointer',
    },
    chipActive: {
        background: '#1d3f42',
        borderColor: darkTheme.textGreen,
        color: darkTheme.textGreen,
        fontWeight: 700,
    },
    count: {
        marginLeft: 6,
        fontWeight: 700,
    },
    activeFilters: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    activeFilter: {
        border: `1px solid ${darkTheme.backgroundControl}`,
        background: darkTheme.backgroundWhite,
        color: darkTheme.textLight,
        borderRadius: 12,
        padding: '2px 10px',
        fontSize: '0.75rem',
        cursor: 'pointer',
    },
    filters: {
        marginBottom: 14,
    },
    empty: {
        background: darkTheme.backgroundLight,
        borderRadius: 6,
        padding: '16px 18px',
        color: darkTheme.textLight,
        fontSize: '0.85rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
    },
})

/**
 * The whole games result. The section runs the catalog's machinery — the label
 * facets with their counts, the durations, the year and player ranges and the
 * rankings are solved there, and `filter.query` goes through the same search
 * engine, so the games are the ones the old tab showed and the count under the
 * section header still matches the chip above. Only the ranking differs from the
 * catalog: a search result starts at `Relevance`, not at `Recommended`.
 *
 * The facets are collapsed behind one button — the list is the result, the filter
 * is a tool the visitor can open — and whatever narrows the list is spelled out
 * under the toolbar. The state lives in the URL next to `q` and `typ`, so a
 * filtered page is still a link.
 */
const GamesSearchPanel = ({ query, state, onStateChange, onReset }: Props) => {
    const { t } = useTranslation('common')
    const classes = useStyles()
    const [offset, setOffset] = useState(0)
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [page, setPage] = useState<Page | undefined>(undefined)

    const facetState = { ...state, query: '' }
    const stateKey = catalogStateKey(facetState)

    const { loading } = useQuery<SearchPageGamesQuery, SearchPageGamesQueryVariables>(searchGamesGql, {
        variables: {
            filter: catalogStateToFilter({ ...state, query }),
            order: state.order,
            offset,
            limit: state.size,
        },
        onCompleted: data => {
            setPage(data.games.catalog)
        },
    })

    useEffect(() => {
        // A new query or a new filter starts at the first page.
        setOffset(0)
    }, [query, stateKey])

    const labelNames = useMemo(
        () =>
            (page?.facets.labels ?? []).reduce<{ [id: string]: string }>((map, label) => {
                if (label.name) map[label.id] = label.name
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

    const activeFilters = catalogActiveFilters(facetState, labelNames)
    // The text is the page's own business, not a filter of this section.
    const narrowed = hasCatalogFilters(facetState)
    const orderTextKey = SEARCH_ORDER_OPTIONS.find(option => option.order === state.order)?.textKey

    if (!page) {
        return <BigLoading />
    }

    return (
        <>
            <div className={classes.heading} data-testid={componentTestIds.search.resultCount}>
                {page.totalAmount === 0
                    ? t('Catalog.empty')
                    : t(narrowed ? 'Search.resultCountGamesFiltered' : 'Search.resultCountGames', {
                          count: page.totalAmount,
                      })}
            </div>

            <div className={classes.toolbar}>
                <button
                    type="button"
                    className={classNames(classes.chip, filtersOpen && classes.chipActive)}
                    onClick={() => setFiltersOpen(open => !open)}
                    data-testid={componentTestIds.search.gamesFilterToggle}
                >
                    {t(filtersOpen ? 'Search.gamesFilterHide' : 'Search.gamesFilter')}
                    {activeFilters.length > 0 && <span className={classes.count}>{activeFilters.length}</span>}
                </button>
                <span className={classes.order} data-testid={componentTestIds.search.gamesOrder}>
                    {t('Catalog.order.label')} {orderTextKey ? t(orderTextKey) : state.order}
                </span>
                <div className={classes.presets}>
                    {CATALOG_PRESETS.map(preset => {
                        if (!presetPatch(preset, labelIdsByName)) {
                            return null
                        }
                        const active = isPresetActive(preset, facetState, labelIdsByName)

                        return (
                            <button
                                key={preset.key}
                                type="button"
                                className={classNames(classes.chip, active && classes.chipActive)}
                                onClick={() => onStateChange(withoutQuery(togglePreset(preset, facetState, labelIdsByName)))}
                                data-testid={componentTestIds.search.gamesPreset(preset.key)}
                            >
                                {t(preset.textKey)}
                            </button>
                        )
                    })}
                </div>
            </div>

            {activeFilters.length > 0 && (
                <div className={classes.activeFilters}>
                    {activeFilters.map(filter => (
                        <button
                            key={filter.key}
                            type="button"
                            className={classes.activeFilter}
                            onClick={() => onStateChange(filter.remove)}
                            data-testid={componentTestIds.search.gamesActiveFilter(filter.key)}
                        >
                            {catalogActiveFilterText(filter, t)} ×
                        </button>
                    ))}
                    <button
                        type="button"
                        className={classes.activeFilter}
                        onClick={onReset}
                        data-testid={componentTestIds.catalog.reset}
                    >
                        {t('Catalog.reset')}
                    </button>
                </div>
            )}

            {filtersOpen && (
                <div className={classes.filters} data-testid={componentTestIds.search.gamesFilterPanel}>
                    <CatalogFilterPanel
                        state={{ ...state, query }}
                        facets={page.facets}
                        onStateChange={onStateChange}
                        onReset={onReset}
                        orders={SEARCH_ORDER_OPTIONS}
                    />
                </div>
            )}

            {page.totalAmount === 0 ? (
                <div className={classes.empty} data-testid={componentTestIds.search.empty}>
                    <span>{t('Catalog.empty')}</span>
                    {narrowed && (
                        <button type="button" className={classes.chip} onClick={onReset}>
                            {t('Catalog.reset')}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div
                        style={loading ? { opacity: 0.5 } : undefined}
                        data-testid={componentTestIds.search.section('games')}
                    >
                        {page.games.map(game => (
                            <SearchGameRow game={game} query={query} key={game.id} />
                        ))}
                    </div>
                    <Pager
                        currentOffset={offset}
                        totalAmount={page.totalAmount}
                        pageSize={state.size}
                        onOffsetChanged={setOffset}
                        rangeLabel
                    />
                </>
            )}
        </>
    )
}

export default GamesSearchPanel
