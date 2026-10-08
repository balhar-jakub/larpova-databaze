import React from 'react'
import Head from 'next/head'
import { createUseStyles } from 'react-jss'
import { useQuery } from '@apollo/client'
import { Row } from 'react-bootstrap'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { HomeHeroPanel } from './HomeHeroPanel'
import { HomePageGamesPanel } from './HomePageGamesPanel'
import { HomePageEventsPanel } from './HomePageEventsPanel'
import { HomePageCommentsPanel } from './HomePageCommentsPanel'
import { HomePageCtaPanel } from './HomePageCtaPanel'
import {
    GetHomePageDataQuery,
    GetHomePageDataQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import * as getHomePageDataDocument from './graphql/getHomePageData.graphql'
import type { DocumentNode } from 'graphql'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'

// The webpack loader exports the document as CommonJS, an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const getHomePageDataQuery = documentOf(getHomePageDataDocument)

/** The catalog's own deep links: the homepage shows a slice, the catalog the list. */
const CATALOG_BEST_RATED = '/games?order=Best&minr=5'
const CATALOG_NEWEST = '/games?order=Newest'
const CATALOG_MOST_COMMENTED = '/games?order=MostCommented'

const useStyles = createUseStyles({
    gamesAndEvents: {
        backgroundColor: darkTheme.background,
        paddingBottom: 35,
    },
    comments: {
        backgroundColor: darkTheme.backgroundNearWhite,
        padding: '15px 0 35px',
    },
})

/**
 * The homepage of a visitor who is not signed in.
 *
 * It answers three questions in order — what is this (hero with the size of the
 * database and a way in), what is worth playing (best rated, newest, upcoming
 * events), what is happening (comments) — and closes by asking for a
 * contribution. Everything links into the catalog with the filter already set,
 * so the blocks are a way into the list, not a dead end.
 *
 * The signed-in visitor gets a different page (see the same panel's personal
 * blocks); this one never reads the session.
 */
export const HomePagePanel = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const homePageQuery = useQuery<GetHomePageDataQuery, GetHomePageDataQueryVariables>(getHomePageDataQuery, {
        // SSR queries disabled — ApolloProvider context propagates but
        // network fetch during SSR is unreliable in Pages Router setup.
        // Data loads client-side on hydration.
        fetchPolicy: 'cache-first',
        nextFetchPolicy: 'cache-and-network',
    })

    const homepage = homePageQuery.data?.homepage
    // With nothing written yet the block would be a 190 px hole in the page.
    const hasComments = (homepage?.lastComments?.length ?? 0) > 0

    return (
        <>
            <Head><title>{t('HomePage.pageTitle')}</title></Head>
            <OpenGraphMeta
                isHomepage
                title={t('HomePage.pageTitle')}
                description={t('HomePage.pageDescription')}
                image="/images/logo200.png"
            />
            <HomeHeroPanel stats={homepage?.stats} labels={homepage?.topLabels} />
            <div className={classes.gamesAndEvents}>
                <WidthFixer>
                    <Row>
                        <HomePageGamesPanel titleKey="HomePage.bestGames" noteKey="HomePage.bestGamesNote" games={homepage?.bestRatedGames} href={CATALOG_BEST_RATED} />
                        <HomePageGamesPanel titleKey="HomePage.lastAddedGames" games={homepage?.lastAddedGames} href={CATALOG_NEWEST} />
                        <HomePageEventsPanel nextEvents={homepage?.nextEvents} href="/kalendar" />
                    </Row>
                </WidthFixer>
            </div>
            {hasComments && (
                <div className={classes.comments}>
                    <HomePageCommentsPanel comments={homepage?.lastComments ?? []} href={CATALOG_MOST_COMMENTED} />
                </div>
            )}
            <HomePageCtaPanel signUpHref="/signUp" createGameHref="/gameEdit" />
        </>
    )
}
