import React, { useState } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { MIN_NUM_RATINGS, RECOMMENDED_FROM } from '../../utils/ratingUtils'
import { GameCatalogOrder } from '../../graphql/__generated__/typescript-operations'
import { CatalogState, DURATION_KEYS, DurationKey, toggleDuration, toggleLabel } from './catalogState'
import { componentTestIds } from '../componentTestIds'

export interface CatalogFacetLabel {
    readonly id: string
    readonly name?: string | null
    readonly count: number
    readonly isRequired: boolean
}

export interface CatalogFacetsData {
    readonly labels: ReadonlyArray<CatalogFacetLabel>
    readonly durations: ReadonlyArray<{ readonly key: string; readonly count: number }>
    readonly yearMin?: number | null
    readonly yearMax?: number | null
}

interface Props {
    readonly state: CatalogState
    readonly facets?: CatalogFacetsData
    readonly onStateChange: (patch: Partial<CatalogState>) => void
    readonly onReset: () => void
}

const THEME_PREVIEW_COUNT = 8

const useStyles = createUseStyles({
    panel: {
        backgroundColor: darkTheme.backgroundRealWhite,
        borderRadius: 5,
        padding: '12px 14px',
    },
    header: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    title: {
        margin: 0,
        fontSize: '0.95rem',
        color: darkTheme.textOnLightDark,
    },
    reset: {
        border: 0,
        background: 'none',
        padding: 0,
        color: darkTheme.textGreenDark,
        fontSize: '0.7rem',
        cursor: 'pointer',
    },
    group: {
        borderTop: `1px solid ${darkTheme.backgroundNearWhite}`,
        padding: '9px 0 3px',
    },
    groupTitle: {
        margin: '0 0 6px',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: darkTheme.textOnLightLighter,
    },
    option: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '2px 0',
        fontSize: '0.75rem',
        color: darkTheme.textOnLight,
        cursor: 'pointer',
    },
    count: {
        marginLeft: 'auto',
        color: darkTheme.textOnLightLighter,
        fontSize: '0.65rem',
    },
    more: {
        border: 0,
        background: 'none',
        padding: '4px 0 0',
        color: darkTheme.textGreenDark,
        fontSize: '0.7rem',
        cursor: 'pointer',
    },
    range: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        margin: '5px 0',
        fontSize: '0.7rem',
    },
    input: {
        width: 62,
        padding: '3px 6px',
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 3,
        fontSize: '0.7rem',
        color: darkTheme.textOnLight,
    },
    queryInput: {
        width: '100%',
        padding: '4px 7px',
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 3,
        fontSize: '0.72rem',
        color: darkTheme.textOnLight,
        outline: 0,
    },
    queryHint: {
        margin: '5px 0 0',
        fontSize: '0.65rem',
        lineHeight: 1.4,
        color: darkTheme.textOnLightLighter,
    },
    modes: {
        display: 'flex',
        gap: 6,
        marginBottom: 8,
    },
    mode: {
        flex: 1,
        padding: '4px 6px',
        border: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderRadius: 3,
        background: darkTheme.backgroundRealWhite,
        color: darkTheme.textOnLight,
        fontSize: '0.68rem',
        cursor: 'pointer',
    },
    modeActive: {
        borderColor: darkTheme.textGreenDark,
        color: darkTheme.textGreenDark,
        fontWeight: 700,
    },
    rank: {
        border: 0,
        background: 'none',
        padding: '2px 0',
        color: darkTheme.textGreenDark,
        fontSize: '0.75rem',
        cursor: 'pointer',
        display: 'block',
        textAlign: 'left',
    },
})

/** Number input pair that commits on blur or Enter, so typing is not fighting the state. */
const RangeInputs = ({
    from,
    to,
    fromPlaceholder,
    toPlaceholder,
    label,
    onChange,
}: {
    from?: number
    to?: number
    fromPlaceholder?: string
    toPlaceholder?: string
    label: string
    onChange: (patch: { from?: number; to?: number }) => void
}) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [values, setValues] = useState({ from: from ?? '', to: to ?? '' })
    const [lastExternal, setLastExternal] = useState(`${from ?? ''}|${to ?? ''}`)

    const external = `${from ?? ''}|${to ?? ''}`
    if (external !== lastExternal) {
        // The filter was changed elsewhere (chip removed, reset) — follow it.
        setLastExternal(external)
        setValues({ from: from ?? '', to: to ?? '' })
    }

    const commit = () => {
        const parse = (value: string | number) => {
            const parsed = Number(value)
            return value === '' || !Number.isFinite(parsed) ? undefined : parsed
        }

        onChange({ from: parse(values.from), to: parse(values.to) })
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') commit()
    }

    return (
        <div className={classes.range}>
            <span>{label}</span>
            <input
                className={classes.input}
                type="number"
                value={values.from}
                placeholder={fromPlaceholder}
                onChange={(event) => setValues({ ...values, from: event.target.value })}
                onBlur={commit}
                onKeyDown={handleKeyDown}
                aria-label={`${label} ${t('Catalog.filters.from')}`}
            />
            <span>{t('Catalog.filters.to')}</span>
            <input
                className={classes.input}
                type="number"
                value={values.to}
                placeholder={toPlaceholder}
                onChange={(event) => setValues({ ...values, to: event.target.value })}
                onBlur={commit}
                onKeyDown={handleKeyDown}
                aria-label={`${label} ${t('Catalog.filters.to')}`}
            />
        </div>
    )
}

const CatalogFilterPanel = ({ state, facets, onStateChange, onReset }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [themesExpanded, setThemesExpanded] = useState(false)
    // The text filter is the one thing here that is not a checkbox: it is kept in
    // local state and committed on Enter or blur, so a request is not fired for
    // every keystroke.
    const [queryDraft, setQueryDraft] = useState(state.query ?? '')
    const [lastQuery, setLastQuery] = useState(state.query ?? '')

    const externalQuery = state.query ?? ''
    if (externalQuery !== lastQuery) {
        setLastQuery(externalQuery)
        setQueryDraft(externalQuery)
    }

    const commitQuery = () => {
        const next = queryDraft.trim()
        if (next !== externalQuery) {
            onStateChange({ query: next || undefined })
        }
    }

    const labels = facets?.labels ?? []
    const categories = labels.filter((label) => label.isRequired)
    const themes = labels.filter((label) => !label.isRequired)
    const visibleThemes = themesExpanded ? themes : themes.slice(0, THEME_PREVIEW_COUNT)
    const durationCounts = new Map((facets?.durations ?? []).map((entry) => [entry.key, entry.count]))

    const labelOption = (label: CatalogFacetLabel) => (
        <label className={classes.option} key={label.id}>
            <input
                type="checkbox"
                checked={state.labels.includes(label.id)}
                onChange={() => onStateChange({ labels: toggleLabel(state, label.id).labels })}
            />
            <span>{label.name}</span>
            <span className={classes.count}>{label.count}</span>
        </label>
    )

    return (
        <div className={classes.panel}>
            <div className={classes.header}>
                <h2 className={classes.title}>{t('Catalog.filters.title')}</h2>
                <button type="button" className={classes.reset} onClick={onReset} data-testid={componentTestIds.catalog.reset}>
                    {t('Catalog.reset')}
                </button>
            </div>

            {state.labels.length > 1 && (
                <div className={classes.modes}>
                    {(['all', 'any'] as const).map((mode) => (
                        <button
                            type="button"
                            key={mode}
                            className={`${classes.mode} ${state.labelMode === mode ? classes.modeActive : ''}`}
                            onClick={() => onStateChange({ labelMode: mode })}
                        >
                            {t(mode === 'all' ? 'Catalog.filters.labelModeAll' : 'Catalog.filters.labelModeAny')}
                        </button>
                    ))}
                </div>
            )}

            <div className={classes.group}>
                <h3 className={classes.groupTitle}>{t('Catalog.filters.query')}</h3>
                <input
                    className={classes.queryInput}
                    type="search"
                    value={queryDraft}
                    placeholder={t('Catalog.filters.queryPlaceholder')}
                    data-testid={componentTestIds.catalog.query}
                    onChange={(event) => setQueryDraft(event.target.value)}
                    onBlur={commitQuery}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            commitQuery()
                        }
                    }}
                />
                <p className={classes.queryHint}>{t('Catalog.filters.queryHint')}</p>
            </div>

            {categories.length > 0 && (
                <div className={classes.group}>
                    <h3 className={classes.groupTitle}>{t('Catalog.filters.categories')}</h3>
                    {categories.map(labelOption)}
                </div>
            )}

            {themes.length > 0 && (
                <div className={classes.group}>
                    <h3 className={classes.groupTitle}>{t('Catalog.filters.themes')}</h3>
                    {visibleThemes.map(labelOption)}
                    {themes.length > THEME_PREVIEW_COUNT && (
                        <button
                            type="button"
                            className={classes.more}
                            onClick={() => setThemesExpanded(!themesExpanded)}
                        >
                            {themesExpanded
                                ? t('Catalog.filters.showFewerThemes')
                                : t('Catalog.filters.showAllThemes', { count: themes.length })}
                        </button>
                    )}
                </div>
            )}

            <div className={classes.group}>
                <h3 className={classes.groupTitle}>{t('Catalog.filters.duration')}</h3>
                {DURATION_KEYS.map((key: DurationKey) => (
                    <label className={classes.option} key={key}>
                        <input
                            type="checkbox"
                            checked={state.durations.includes(key)}
                            onChange={() => onStateChange({ durations: toggleDuration(state, key).durations })}
                        />
                        <span>{t(`Catalog.durations.${key}`)}</span>
                        <span className={classes.count}>{durationCounts.get(key) ?? 0}</span>
                    </label>
                ))}
            </div>

            <div className={classes.group}>
                <h3 className={classes.groupTitle}>{t('Catalog.filters.year')}</h3>
                <RangeInputs
                    from={state.yearFrom}
                    to={state.yearTo}
                    fromPlaceholder={facets?.yearMin != null ? String(facets.yearMin) : undefined}
                    toPlaceholder={facets?.yearMax != null ? String(facets.yearMax) : undefined}
                    label={t('Catalog.filters.yearShort')}
                    onChange={({ from, to }) => onStateChange({ yearFrom: from, yearTo: to })}
                />
            </div>

            <div className={classes.group}>
                <h3 className={classes.groupTitle}>{t('Catalog.filters.players')}</h3>
                <RangeInputs
                    from={state.playersFrom}
                    to={state.playersTo}
                    label={t('Catalog.filters.playersShort')}
                    onChange={({ from, to }) => onStateChange({ playersFrom: from, playersTo: to })}
                />
            </div>

            <div className={classes.group}>
                <h3 className={classes.groupTitle}>{t('Catalog.filters.rating')}</h3>
                <label className={classes.option}>
                    <input
                        type="checkbox"
                        checked={state.minRating === RECOMMENDED_FROM}
                        onChange={() =>
                            onStateChange({
                                minRating: state.minRating === RECOMMENDED_FROM ? undefined : RECOMMENDED_FROM,
                            })
                        }
                    />
                    <span>{t('Catalog.filters.onlyRecommended', { value: RECOMMENDED_FROM })}</span>
                </label>
                <label className={classes.option}>
                    <input
                        type="checkbox"
                        checked={state.minRatings === MIN_NUM_RATINGS}
                        onChange={() =>
                            onStateChange({
                                minRatings: state.minRatings === MIN_NUM_RATINGS ? undefined : MIN_NUM_RATINGS,
                            })
                        }
                    />
                    <span>{t('Catalog.filters.minRatings', { count: MIN_NUM_RATINGS })}</span>
                </label>
                <label className={classes.option}>
                    <input
                        type="checkbox"
                        checked={state.withComments}
                        onChange={() => onStateChange({ withComments: !state.withComments })}
                    />
                    <span>{t('Catalog.filters.withComments')}</span>
                </label>
                <label className={classes.option}>
                    <input
                        type="checkbox"
                        checked={state.withImage}
                        onChange={() => onStateChange({ withImage: !state.withImage })}
                    />
                    <span>{t('Catalog.filters.withImage')}</span>
                </label>
            </div>

            <div className={classes.group}>
                <h3 className={classes.groupTitle}>{t('Catalog.rankings.title')}</h3>
                {[
                    { order: GameCatalogOrder.Recommended, textKey: 'Catalog.rankings.all' },
                    { order: GameCatalogOrder.Best, textKey: 'Catalog.order.Best' },
                    { order: GameCatalogOrder.MostPlayed, textKey: 'Catalog.order.MostPlayed' },
                    { order: GameCatalogOrder.Newest, textKey: 'Catalog.order.Newest' },
                    { order: GameCatalogOrder.MostCommented, textKey: 'Catalog.order.MostCommented' },
                ].map((entry) => (
                    <button
                        type="button"
                        key={entry.order}
                        className={classes.rank}
                        onClick={() => onStateChange({ order: entry.order, addedWithinDays: undefined })}
                    >
                        {state.order === entry.order ? `▸ ${t(entry.textKey)}` : t(entry.textKey)}
                    </button>
                ))}
            </div>
        </div>
    )
}

export default CatalogFilterPanel
