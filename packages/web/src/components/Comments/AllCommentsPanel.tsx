import React, { useEffect, useState } from 'react'
import { useQuery } from '@apollo/client'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import type { DocumentNode } from 'graphql'
import {
    AllCommentsPageQuery,
    AllCommentsPageQueryVariables,
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

interface Props {}

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
        margin: '0 0 18px',
    },
    empty: {
        backgroundColor: darkTheme.backgroundAlmostNearWhite2,
        borderRadius: 5,
        padding: '16px 18px',
        color: darkTheme.textOnLightDark,
        fontSize: '0.85rem',
    },
})

/**
 * Every comment in the database, newest first — the page the homepage's
 * „všechny komentáře“ link opens. What the catalog is for games: the whole
 * content in one list, one screenful at a time, each row leading to the game
 * (and the comment's author) it belongs to.
 *
 * The page has no filters — comments carry no labels, durations or years to
 * filter by; what the visitor wants to find is either on this page (newest
 * activity) or on the game's own detail.
 */
export const AllCommentsPanel = (_props: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const [offset, setOffset] = useState(0)

    const query = useQuery<AllCommentsPageQuery, AllCommentsPageQueryVariables>(allCommentsGql, {
        variables: { offset, limit: COMMENTS_PAGE_SIZE },
        fetchPolicy: 'cache-and-network',
    })

    // The query selects a subset of Comment (what GameCommentPanel reads); the
    // panel's prop is the schema-wide CommentsPaged — the same cast the profile
    // and the game detail use for their pages.
    const page = query.data?.allComments as CommentsPaged | undefined

    // A pager click scrolls the next page's rows into the visitor's view —
    // without it the list swaps but the screen stays where it was.
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [offset])

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
                        <div className={classes.empty}>{t('Comments.empty')}</div>
                    )}
                </WidthFixer>
            </div>
        </>
    )
}
