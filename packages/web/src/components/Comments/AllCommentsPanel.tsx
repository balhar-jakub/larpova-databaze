import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import { useRouter } from 'next/router'
import { useTranslation } from 'src/lib/i18n'
import type { DocumentNode } from 'graphql'
import {
    AllCommentsPageQuery,
    AllCommentsPageQueryVariables,
    CommentLength,
    CommentsPaged,
} from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import BigLoading from '../common/BigLoading/BigLoading'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'
import PagedCommentsPanel from '../common/PagedCommentsPanel/PagedCommentsPanel'

import * as allCommentsDocument from './graphql/allCommentsPage.graphql'

// The webpack loader exports the document as CommonJS; an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const allCommentsGql = documentOf(allCommentsDocument)

/** The same page size the game detail and the profile list use. */
export const COMMENTS_PAGE_SIZE = 10

const LENGTH_VALUES: CommentLength[] = [CommentLength.Short, CommentLength.Medium, CommentLength.Long]

// Takes no props; kept as a type so the component keeps a uniform shape.

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0 40px',
        minHeight: '60vh',
    },
    title: {
        margin: '0 0 4px',
        fontSize: '1.6rem',
        color: darkTheme.textOnLightDark,
    },
    subtitle: {
        fontSize: '0.78rem',
        color: darkTheme.textOnLightLighter,
        margin: '0 0 14px',
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        borderTop: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        borderBottom: `1px solid ${darkTheme.backgroundAlmostNearWhite}`,
        padding: '10px 0',
        margin: '0 0 10px',
    },
    toolbarLabel: {
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
    },
    chips: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        border: `1px solid ${darkTheme.textOnLight}`,
        borderRadius: 14,
        padding: '3px 10px',
        fontSize: '0.72rem',
        fontWeight: 600,
        color: darkTheme.textOnLight,
        backgroundColor: 'transparent',
        cursor: 'pointer',
        '&:hover': {
            borderColor: darkTheme.textGreen,
            color: darkTheme.textGreenDark,
        },
    },
    chipActive: {
        backgroundColor: darkTheme.textGreen,
        borderColor: darkTheme.textGreen,
        color: darkTheme.textLight,
        fontWeight: 700,
    },
    yearChip: {
        border: `1px solid ${darkTheme.textOnLight}`,
        borderRadius: 3,
        padding: '2px 7px',
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
        backgroundColor: 'transparent',
        cursor: 'pointer',
        '&:hover': {
            borderColor: darkTheme.textGreen,
            color: darkTheme.textGreenDark,
        },
    },
    yearChipActive: {
        backgroundColor: darkTheme.backgroundControl,
        color: darkTheme.text,
        borderColor: darkTheme.backgroundControl,
        fontWeight: 700,
    },
    empty: {
        backgroundColor: darkTheme.backgroundAlmostNearWhite2,
        borderRadius: 5,
        padding: '16px 18px',
        color: darkTheme.textOnLightDark,
        fontSize: '0.85rem',
    },
})

const lengthFromParam = (param: unknown): CommentLength | undefined => {
    if (Array.isArray(param)) param = param[0]
    if (typeof param !== 'string') return undefined
    const value = param.toUpperCase()
    return (LENGTH_VALUES as string[]).includes(value) ? (value as CommentLength) : undefined
}

const yearFromParam = (param: unknown): number | undefined => {
    if (Array.isArray(param)) param = param[0]
    const year = typeof param === 'string' ? parseInt(param, 10) : NaN
    return Number.isInteger(year) && year >= 2012 && year <= 2100 ? year : undefined
}

/**
 * Every comment in the database, newest first — the page the homepage's
 * „všechny komentáře“ link opens. What the catalog is for games: the whole
 * content in one list, one screenful at a time, each row leading to the game
 * (and the comment's author) it belongs to.
 *
 * The page's two filters live in the URL (`delka`, `rok`), because a filtered
 * list is a link — „dlouhé recenze z roku 2021“ is exactly the kind of page a
 * visitor pastes into a forum. Comments carry no labels or authors to browse
 * by (those live on the game's own page); the reading weight and the year are
 * what this data can answer.
 */
export const AllCommentsPanel = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const router = useRouter()

    const length = lengthFromParam(router.query.delka)
    const year = yearFromParam(router.query.rok)
    const [offset, setOffset] = useState(0)

    const query = useQuery<AllCommentsPageQuery, AllCommentsPageQueryVariables>(allCommentsGql, {
        variables: { offset, limit: COMMENTS_PAGE_SIZE, length, year },
        fetchPolicy: 'cache-and-network',
    })

    // The query selects a subset of Comment (what GameCommentPanel reads); the
    // panel's prop is the schema-wide CommentsPaged — the same cast the profile
    // and the game detail use for their pages.
    const page = query.data?.allComments as CommentsPaged | undefined
    const stats = query.data?.commentsStats

    // A filter change resets the pager and rewrites the URL; the router change
    // flows back into the query variables through `router.query` above.
    const setFilter = (patch: { delka?: CommentLength | null; rok?: number | null }) => {
        const next = { ...router.query }
        if ('delka' in patch) {
            if (patch.delka) next.delka = patch.delka.toLowerCase()
            else delete next.delka
        }
        if ('rok' in patch) {
            if (patch.rok) next.rok = String(patch.rok)
            else delete next.rok
        }
        setOffset(0)
        router.push({ pathname: '/komentare', query: next }, undefined, { shallow: true })
    }

    // A pager click scrolls the next page's rows into the visitor's view —
    // without it the list swaps but the screen stays where it was.
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [offset])

    const lengthLabel = useMemo(
        () => ({
            SHORT: t('Comments.lengthShort', { amount: stats?.lengths.SHORT ?? 0 }),
            MEDIUM: t('Comments.lengthMedium', { amount: stats?.lengths.MEDIUM ?? 0 }),
            LONG: t('Comments.lengthLong', { amount: stats?.lengths.LONG ?? 0 }),
        }),
        [t, stats],
    )

    const years = useMemo(
        () => [...(stats?.years ?? [])].sort((a, b) => b.year - a.year),
        [stats],
    )

    return (
        <>
            <OpenGraphMeta
                title={t('Comments.pageTitle')}
                description={t('Comments.pageDescription')}
            />
            <div className={classes.row}>
                <WidthFixer>
                    <h1 className={classes.title}>{t('Comments.pageTitle')}</h1>
                    <p className={classes.subtitle}>{t('Comments.pageSubtitle')}</p>
                    <div className={classes.toolbar}>
                        <span className={classes.toolbarLabel}>{t('Comments.filterLength')}</span>
                        <div className={classes.chips}>
                            <button
                                type="button"
                                className={`${classes.chip} ${!length ? classes.chipActive : ''}`}
                                onClick={() => setFilter({ delka: null })}
                            >
                                {t('Comments.lengthAll')}
                            </button>
                            {LENGTH_VALUES.map(value => (
                                <button
                                    type="button"
                                    key={value}
                                    className={`${classes.chip} ${length === value ? classes.chipActive : ''}`}
                                    onClick={() => setFilter({ delka: length === value ? null : value })}
                                >
                                    {lengthLabel[value]}
                                </button>
                            ))}
                        </div>
                        {years.length > 0 && (
                            <>
                                <span className={classes.toolbarLabel}>{t('Comments.filterYear')}</span>
                                <div className={classes.chips}>
                                    <button
                                        type="button"
                                        className={`${classes.yearChip} ${!year ? classes.yearChipActive : ''}`}
                                        onClick={() => setFilter({ rok: null })}
                                    >
                                        {t('Comments.yearAll')}
                                    </button>
                                    {years.map(({ year: y, amount }) => (
                                        <button
                                            type="button"
                                            key={y}
                                            title={t('Comments.yearCount', { amount })}
                                            className={`${classes.yearChip} ${year === y ? classes.yearChipActive : ''}`}
                                            onClick={() => setFilter({ rok: year === y ? null : y })}
                                        >
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    {query.loading && !page ? (
                        <BigLoading />
                    ) : page && page.totalAmount > 0 ? (
                        <PagedCommentsPanel
                            page={page}
                            loading={query.loading}
                            pageSize={COMMENTS_PAGE_SIZE}
                            offset={offset}
                            onOffsetChanged={setOffset}
                            rangeLabel
                        />
                    ) : (
                        <div className={classes.empty}>{t('Comments.emptyFiltered')}</div>
                    )}
                </WidthFixer>
            </div>
        </>
    )
}
