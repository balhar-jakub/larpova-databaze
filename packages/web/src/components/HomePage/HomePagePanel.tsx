import React from 'react'
import Head from 'next/head'
import { createUseStyles } from 'react-jss'
import { useQuery } from '@apollo/client'
import { Row } from 'react-bootstrap'
import { useTranslation } from 'src/lib/i18n'
import { useLoggedInUser } from 'src/hooks/useLoggedInUser'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import { HomeHeroPanel } from './HomeHeroPanel'
import { HomePersonalPanel } from './HomePersonalPanel'
import { HomeEmptyPanel } from './HomeEmptyPanel'
import { HomeMyEventsPanel } from './HomeMyEventsPanel'
import { HomeToFinishPanel } from './HomeToFinishPanel'
import { HomeAuthoredPanel } from './HomeAuthoredPanel'
import { HomeRecommendedPanel } from './HomeRecommendedPanel'
import { HomePageGamesPanel } from './HomePageGamesPanel'
import { HomePageEventsPanel } from './HomePageEventsPanel'
import { HomePageCommentsPanel } from './HomePageCommentsPanel'
import { HomePageCtaPanel } from './HomePageCtaPanel'
import {
    GetHomePageDataQuery,
    GetHomePageDataQueryVariables,
    GetHomePageUserQuery,
    GetHomePageUserQueryVariables,
} from '../../graphql/__generated__/typescript-operations'
import * as getHomePageDataDocument from './graphql/getHomePageData.graphql'
import * as getHomePageUserDocument from './graphql/homePageUser.graphql'
import type { DocumentNode } from 'graphql'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'

// The webpack loader exports the document as CommonJS, an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const getHomePageDataQuery = documentOf(getHomePageDataDocument)
const getHomePageUserQuery = documentOf(getHomePageUserDocument)

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
 * The homepage, in three shapes.
 *
 * An anonymous visitor gets a shop window: what the database holds, the best
 * rated and newest games, the events ahead and the newest comments.
 *
 * A signed-in visitor gets their own list of things to do instead — the events
 * of the games they want to play (the only block with a deadline, so it leads),
 * what they left half-done, what their own games are doing and what the labels
 * of their favourite games recommend. The general blocks are dropped: a
 * "Nejlépe hodnocené" they have seen a hundred times is not why they came back.
 *
 * An account with nothing in the database (36 % of them) gets the first steps
 * and the anonymous content, not five empty blocks.
 */
export const HomePagePanel = () => {
    const classes = useStyles()
    const { t } = useTranslation('common')
    const loggedInUser = useLoggedInUser()
    const signedIn = Boolean(loggedInUser?.id)
    // `useLoggedInUser` answers three ways: `undefined` once the provider knows
    // nobody is signed in, an empty object while it is still asking, and the user
    // itself when there is one. Only a settled answer may decide the page — a
    // `{}` treated as "anonymous" would flash the shop window at a signed-in
    // visitor, and one treated as "signed in" would blank the page for everybody
    // else.
    const stillAsking = loggedInUser !== undefined && !signedIn
    const settled = !stillAsking

    const homePageQuery = useQuery<GetHomePageDataQuery, GetHomePageDataQueryVariables>(getHomePageDataQuery, {
        // SSR queries disabled — ApolloProvider context propagates but
        // network fetch during SSR is unreliable in Pages Router setup.
        // Data loads client-side on hydration.
        fetchPolicy: 'cache-first',
        nextFetchPolicy: 'cache-and-network',
    })
    const personalQuery = useQuery<GetHomePageUserQuery, GetHomePageUserQueryVariables>(getHomePageUserQuery, {
        skip: !signedIn,
        fetchPolicy: 'cache-and-network',
    })

    const homepage = homePageQuery.data?.homepage
    const my = personalQuery.data?.homepage?.myHome
    // With nothing written yet the block would be a 190 px hole in the page.
    const hasComments = (homepage?.lastComments?.length ?? 0) > 0

    const personal = Boolean(signedIn && my?.hasData)
    const emptyState = Boolean(signedIn && my && !my.hasData)
    const anonymous = !signedIn && settled

    return (
        <>
            <Head><title>{t('HomePage.pageTitle')}</title></Head>
            <OpenGraphMeta
                isHomepage
                title={t('HomePage.pageTitle')}
                description={t('HomePage.pageDescription')}
                image="/images/logo200.png"
            />
            {signedIn ? (
                emptyState ? (
                    <HomeEmptyPanel name={loggedInUser?.name} />
                ) : (
                    <HomePersonalPanel
                        name={loggedInUser?.name}
                        userId={loggedInUser?.id}
                        playedCount={my?.playedCount}
                        wantedCount={my?.wantedCount}
                        authoredCount={my?.authoredCount}
                        commentsCount={my?.commentsCount}
                    />
                )
            ) : anonymous ? (
                <HomeHeroPanel stats={homepage?.stats} labels={homepage?.topLabels} />
            ) : null}
            {personal && my ? (
                <div className={classes.gamesAndEvents}>
                    <WidthFixer>
                        <Row>
                            <HomeMyEventsPanel
                                events={my.myEvents}
                                wantedCount={my.wantedCount}
                                withoutEvent={my.wantedWithoutEvent}
                                userId={loggedInUser?.id}
                            />
                            <HomeToFinishPanel
                                toRate={my.toRate}
                                oldestWanted={my.oldestWanted}
                                wantedCount={my.wantedCount}
                            />
                            <HomeAuthoredPanel authored={my.authored} authoredCount={my.authoredCount} />
                            <HomeRecommendedPanel labels={my.recommendedLabels} games={my.recommended} />
                            <HomePageEventsPanel nextEvents={homepage?.nextEvents} href="/kalendar" />
                        </Row>
                    </WidthFixer>
                </div>
            ) : emptyState || anonymous ? (
                <>
                    <div className={classes.gamesAndEvents}>
                        <WidthFixer>
                            <Row>
                                <HomePageGamesPanel titleKey="HomePage.bestGames" noteKey="HomePage.bestGamesNote" games={homepage?.bestRatedGames} href={CATALOG_BEST_RATED} />
                                <HomePageGamesPanel titleKey="HomePage.lastAddedGames" games={homepage?.lastAddedGames} href={CATALOG_NEWEST} />
                                <HomePageEventsPanel nextEvents={homepage?.nextEvents} href="/kalendar" />
                            </Row>
                        </WidthFixer>
                    </div>
                    {anonymous && hasComments && (
                        <div className={classes.comments}>
                            <HomePageCommentsPanel comments={homepage?.lastComments ?? []} href={CATALOG_MOST_COMMENTED} />
                        </div>
                    )}
                </>
            ) : null}
            {signedIn ? (
                <HomePageCtaPanel
                    titleKey="HomePage.ctaPersonalTitle"
                    textKey="HomePage.ctaPersonalText"
                    primaryKey="HomePage.personalProfile"
                    primaryHref="/profile/current"
                    secondaryKey="HomePage.ctaCreateGame"
                    secondaryHref="/gameEdit"
                />
            ) : (
                <HomePageCtaPanel />
            )}
        </>
    )
}
