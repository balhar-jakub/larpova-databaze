import React, { useEffect, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { DocumentNode } from 'graphql'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { darkTheme } from '../../theme/darkTheme'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import BigLoading from '../common/BigLoading/BigLoading'
import OpenGraphMeta from '../common/OpenGraphMeta/OpenGraphMeta'
import { GameLink } from '../common/GameLink/GameLink'
import { GameRatingBox } from '../common/GameRatingBox/GameRatingBox'
import { ProfileImage } from '../common/ProfileImage/ProfileImage'
import { componentTestIds } from '../componentTestIds'
import { YearReviewPageQuery } from '../../graphql/__generated__/typescript-operations'

import * as yearReviewDocument from './graphql/yearReviewPage.graphql'

const PAGE_TITLE_KEY = 'YearReview.pageTitle'

// The webpack loader exports the document as CommonJS; an ESM import of a stub
// (tests) arrives empty — unwrap whichever shape turned up.
const documentOf = (value: unknown) => ((value as { default?: unknown })?.default ?? value) as DocumentNode
const yearReviewGql = documentOf(yearReviewDocument)

type YearReviewData = YearReviewPageQuery['yearReview']
type FeaturedGameRow = YearReviewData['featuredGames'][number]
type RunnerUpGameRow = YearReviewData['runnerUpGames'][number]
type NewGameRow = YearReviewData['newGames'][number]
type QuoteRow = YearReviewData['quotes'][number]
type ArticleRow = YearReviewData['articles'][number]

interface Props {
    readonly year: number
}

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0 40px',
        minHeight: '60vh',
    },
    loading: {
        opacity: 0.5,
    },
    container: {
        maxWidth: 1110,
        margin: '0 auto',
        padding: '0 34px',
    },
    brand: {
        color: darkTheme.red,
        fontWeight: 700,
        fontSize: '0.75rem',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
    },
    title: {
        margin: '10px 0 6px',
        fontSize: '1.6rem',
        color: darkTheme.textOnLightDark,
    },
    subtitle: {
        fontSize: '0.78rem',
        color: darkTheme.textOnLightLighter,
        maxWidth: 720,
    },
    ticker: {
        display: 'flex',
        gap: 26,
        flexWrap: 'wrap',
        marginTop: 18,
        fontSize: '0.8rem',
        color: darkTheme.textOnLight,
    },
    tickerValue: {
        fontSize: '1rem',
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
    },
    sectionTitle: {
        margin: '30px 0 2px',
        fontSize: '1.1rem',
        fontWeight: 700,
        color: darkTheme.textOnLightDark,
    },
    sectionSubtitle: {
        fontSize: '0.75rem',
        color: darkTheme.textOnLightLighter,
        margin: '0 0 12px',
        maxWidth: 640,
    },
    featuredGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
    },
    featuredCard: {
        backgroundColor: darkTheme.backgroundNearWhite,
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    featuredCover: {
        position: 'relative',
        height: 170,
        backgroundColor: darkTheme.backgroundControl,
        '& img': {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
        },
    },
    featuredBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
    },
    featuredBody: {
        padding: '14px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
    },
    featuredName: {
        fontSize: '1.05rem',
        color: darkTheme.textOnLightDark,
        lineHeight: 1.25,
    },
    featuredMeta: {
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
        marginTop: 4,
    },
    authorsRow: {
        display: 'flex',
        alignItems: 'center',
        marginTop: 12,
    },
    authorsRest: {
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
        marginLeft: 8,
    },
    runnerGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 0,
        '@media only screen and (min-width: 700px)': {
            gridTemplateColumns: '1fr 1fr',
            columnGap: 32,
        },
    },
    runnerRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderTop: `1px dashed ${darkTheme.backgroundAlmostNearWhite2}`,
    },
    runnerThumb: {
        width: 52,
        height: 38,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: darkTheme.backgroundControl,
        flex: 'none',
        '& img': {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
        },
    },
    runnerName: {
        fontWeight: 700,
        fontSize: '0.85rem',
        color: darkTheme.textOnLightDark,
    },
    runnerNote: {
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
        marginTop: 1,
    },
    runnerVotes: {
        marginLeft: 'auto',
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
        textAlign: 'right',
        whiteSpace: 'nowrap',
    },
    newGamesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 10,
    },
    newGameCard: {
        backgroundColor: darkTheme.backgroundAlmostNearWhite2,
        borderRadius: 8,
        padding: '8px 10px 10px',
    },
    newGameDate: {
        fontSize: '0.65rem',
        fontWeight: 700,
        color: darkTheme.textOnLightLighter,
    },
    newGameName: {
        fontSize: '0.72rem',
        color: darkTheme.textOnLightDark,
        lineHeight: 1.25,
        marginTop: 2,
        fontWeight: 600,
    },
    newGameBadge: {
        marginTop: 6,
        '& > span': {
            display: 'inline-block',
        },
    },
    quotesGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 12,
        '@media only screen and (min-width: 700px)': {
            gridTemplateColumns: '1fr 1fr',
        },
    },
    quoteCard: {
        backgroundColor: darkTheme.backgroundNearWhite,
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        gap: 13,
    },
    quoteText: {
        fontSize: '0.82rem',
        color: darkTheme.textOnLightDark,
        fontStyle: 'italic',
        lineHeight: 1.55,
    },
    quoteWho: {
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
        marginTop: 8,
    },
    articlesGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 12,
        '@media only screen and (min-width: 700px)': {
            gridTemplateColumns: '1fr 1fr',
        },
    },
    articleCard: {
        backgroundColor: darkTheme.backgroundNearWhite,
        borderRadius: 8,
        padding: '16px 18px',
        borderLeft: `4px solid ${darkTheme.blue}`,
    },
    articleSource: {
        display: 'inline-block',
        fontSize: '0.62rem',
        fontWeight: 700,
        color: darkTheme.textLight,
        backgroundColor: darkTheme.backgroundControl,
        borderRadius: 3,
        padding: '2px 7px',
        marginRight: 6,
    },
    articleTitle: {
        fontSize: '0.88rem',
        color: darkTheme.textOnLightDark,
        lineHeight: 1.35,
        '& a': {
            color: darkTheme.textOnLightDark,
        },
    },
    articleMeta: {
        fontSize: '0.7rem',
        color: darkTheme.textOnLightLighter,
        marginTop: 5,
    },
    articlePerex: {
        fontSize: '0.75rem',
        color: darkTheme.textOnLight,
        marginTop: 8,
        lineHeight: 1.5,
    },
    foot: {
        marginTop: 26,
        paddingTop: 12,
        borderTop: `1px solid ${darkTheme.backgroundAlmostNearWhite2}`,
        fontSize: '0.72rem',
        color: darkTheme.textOnLightLighter,
    },
})

/** Cover image URL the same way the catalog builds it. */
const gameCoverUrl = (gameId: string | number, imageId: string | number) =>
    `/game-image/?id=${gameId}&imageId=${imageId}`

/** How many characters a quote card shows; the rest is ellipsized. */
const QUOTE_MAX_LENGTH = 260;

/** A quote from a review, trimmed for the card: the review headers the
 *  community writes ("Recenze: …", "Autor: …", "1. běh, Monika") stay — they
 *  are part of the voice — but the card shows only the first part. */
const quoteExcerpt = (text: string | null | undefined): string | null => {
    if (!text) return null
    const clean = text.replace(/\s+/g, ' ').trim()
    if (clean.length <= QUOTE_MAX_LENGTH) return clean
    // Cut at the last space before the limit so no word is cut in half.
    const cut = clean.slice(0, QUOTE_MAX_LENGTH)
    const lastSpace = cut.lastIndexOf(' ')
    return `${lastSpace > QUOTE_MAX_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut}…`
}

const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return null
    const date = new Date(iso)
    if (isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(date)
}

const YearReviewPanel = ({ year }: Props) => {
    const classes = useStyles()
    const client = useApolloClient()
    const { t } = useTranslation()
    const [data, setData] = useState<YearReviewData | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        client
            .query({ query: yearReviewGql, variables: { year } })
            .then((result) => {
                if (!cancelled) setData((result.data as { yearReview: YearReviewData }).yearReview)
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message)
            })
        return () => {
            cancelled = true
        }
    }, [client, year])

    if (error) {
        return (
            <WidthFixer>
                <div className={classes.row} data-testid={componentTestIds.yearReview.page}>
                    <div className={classes.container}>
                        <h1 className={classes.title}>{t(PAGE_TITLE_KEY, { year })}</h1>
                        <p className={classes.subtitle}>{error}</p>
                    </div>
                </div>
            </WidthFixer>
        )
    }

    if (!data) {
        return (
            <WidthFixer>
                <div className={classes.row + ' ' + classes.loading} data-testid={componentTestIds.yearReview.page}>
                    <BigLoading />
                </div>
            </WidthFixer>
        )
    }

    const featured = data.featuredGames
    const runnerUps = data.runnerUpGames
    const newGames = data.newGames
    const quotes = data.quotes
    const articles = data.articles

    return (
        <WidthFixer>
            <div className={classes.row} data-testid={componentTestIds.yearReview.page}>
                <OpenGraphMeta
                    title={t(PAGE_TITLE_KEY, { year })}
                    description={t('YearReview.pageDescription')}
                />
                <div className={classes.container}>
                    <div className={classes.brand}>{t('YearReview.brand')}</div>
                    <h1 className={classes.title}>{t(PAGE_TITLE_KEY, { year })}</h1>
                    <p className={classes.subtitle}>{t('YearReview.pageDescription')}</p>
                    <div className={classes.ticker}>
                        <span>
                            <span className={classes.tickerValue}>{newGames.length}</span>{' '}
                            {t('YearReview.tickerNewGames')}
                        </span>
                        <span>
                            <span className={classes.tickerValue}>{quotes.length}</span>{' '}
                            {t('YearReview.tickerQuotes')}
                        </span>
                        <span>
                            <span className={classes.tickerValue}>{articles.length}</span>{' '}
                            {t('YearReview.tickerArticles')}
                        </span>
                    </div>

                    <h2 className={classes.sectionTitle}>{t('YearReview.featuredTitle')}</h2>
                    <p className={classes.sectionSubtitle}>{t('YearReview.featuredSubtitle')}</p>
                    <div className={classes.featuredGrid} data-testid={componentTestIds.yearReview.featured}>
                        {featured.map(({ game, votesInYear }: FeaturedGameRow) => (
                            <div key={game.id} className={classes.featuredCard}>
                                <div className={classes.featuredCover}>
                                    {game.coverImage && (
                                        <img
                                            src={gameCoverUrl(game.id, game.coverImage.id)}
                                            alt={game.name ?? ''}
                                        />
                                    )}
                                    <div className={classes.featuredBadge}>
                                        <GameRatingBox
                                            rating={undefined}
                                            averageRating={game.averageRating}
                                            amountOfRatings={game.amountOfRatings}
                                            onPhoto
                                            size="small"
                                        />
                                    </div>
                                </div>
                                <div className={classes.featuredBody}>
                                    <div className={classes.featuredName}>
                                        <GameLink game={game}>{game.name}</GameLink>
                                    </div>
                                    <div className={classes.featuredMeta}>
                                        {game.labels
                                            ?.filter((l) => l?.name)
                                            .map((l) => l!.name)
                                            .join(' · ')}
                                    </div>
                                    <div className={classes.featuredMeta}>
                                        {t('YearReview.votesInYear', { count: votesInYear })} ·{' '}
                                        {t('YearReview.authorsCount', { count: game.authors?.length ?? 0 })}
                                    </div>
                                    <div className={classes.authorsRow}>
                                        {(game.authors ?? []).slice(0, 5).map((author) => (
                                            <ProfileImage
                                                key={author.id}
                                                userId={author.id}
                                                imageId={author.image?.id}
                                            />
                                        ))}
                                        {(game.authors?.length ?? 0) > 5 && (
                                            <span className={classes.authorsRest}>
                                                +{(game.authors?.length ?? 0) - 5}{' '}
                                                {t('YearReview.moreAuthors')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {runnerUps.length > 0 && (
                        <>
                            <h2 className={classes.sectionTitle}>{t('YearReview.runnerUpTitle')}</h2>
                            <p className={classes.sectionSubtitle}>{t('YearReview.runnerUpSubtitle')}</p>
                            <div className={classes.runnerGrid} data-testid={componentTestIds.yearReview.runnerUps}>
                                {runnerUps.map(({ game, votesInYear }: RunnerUpGameRow) => (
                                    <div key={game.id} className={classes.runnerRow}>
                                        <div className={classes.runnerThumb}>
                                            {game.coverImage && (
                                                <img
                                                    src={gameCoverUrl(game.id, game.coverImage.id)}
                                                    alt={game.name ?? ''}
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <div className={classes.runnerName}>
                                                <GameLink game={game}>{game.name}</GameLink>
                                            </div>
                                            <div className={classes.runnerNote}>
                                                {t('YearReview.votesInYear', { count: votesInYear })}
                                            </div>
                                        </div>
                                        <div className={classes.runnerVotes}>
                                            <GameRatingBox
                                                rating={undefined}
                                                averageRating={game.averageRating}
                                                amountOfRatings={game.amountOfRatings}
                                                size="tiny"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {newGames.length > 0 && (
                        <>
                            <h2 className={classes.sectionTitle}>{t('YearReview.newGamesTitle')}</h2>
                            <p className={classes.sectionSubtitle}>{t('YearReview.newGamesSubtitle')}</p>
                            <div className={classes.newGamesGrid} data-testid={componentTestIds.yearReview.newGames}>
                                {newGames.map((game: NewGameRow) => (
                                    <div key={game.id} className={classes.newGameCard}>
                                        <div className={classes.newGameDate}>{fmtDate(game.added)}</div>
                                        <div className={classes.newGameName}>
                                            <GameLink game={game}>{game.name}</GameLink>
                                        </div>
                                        <div className={classes.newGameBadge}>
                                            <GameRatingBox
                                                rating={undefined}
                                                averageRating={game.averageRating}
                                                amountOfRatings={game.amountOfRatings}
                                                size="tiny"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {quotes.length > 0 && (
                        <>
                            <h2 className={classes.sectionTitle}>{t('YearReview.quotesTitle')}</h2>
                            <p className={classes.sectionSubtitle}>{t('YearReview.quotesSubtitle')}</p>
                            <div className={classes.quotesGrid} data-testid={componentTestIds.yearReview.quotes}>
                                {quotes.map((quote: QuoteRow) => (
                                    <div key={quote.id} className={classes.quoteCard}>
                                        <ProfileImage
                                            userId={quote.user?.id}
                                            imageId={quote.user?.image?.id}
                                        />
                                        <div>
                                            <p className={classes.quoteText}>„{quoteExcerpt(quote.text)}“</p>
                                            <div className={classes.quoteWho}>
                                                {quote.user?.name} · {t('YearReview.quoteGame')}{' '}
                                                {quote.game && <GameLink game={quote.game}>{quote.game.name}</GameLink>}
                                                {quote.added && fmtDate(quote.added) ? ` · ${fmtDate(quote.added)}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {articles.length > 0 && (
                        <>
                            <h2 className={classes.sectionTitle}>{t('YearReview.articlesTitle')}</h2>
                            <p className={classes.sectionSubtitle}>{t('YearReview.articlesSubtitle')}</p>
                            <div className={classes.articlesGrid} data-testid={componentTestIds.yearReview.articles}>
                                {articles.map((article: ArticleRow) => (
                                    <div key={article.id} className={classes.articleCard}>
                                        <span className={classes.articleSource}>
                                            {article.source === 'LARPY_CZ' ? 'larpy.cz' : 'larp.cz'}
                                        </span>
                                        <div className={classes.articleTitle}>
                                            <a href={article.url} target="_blank" rel="noreferrer noopener">
                                                {article.title}
                                            </a>
                                        </div>
                                        <div className={classes.articleMeta}>
                                            {[article.authors, fmtDate(article.publishedAt)]
                                                .filter(Boolean)
                                                .join(' · ')}
                                            {article.categories?.length
                                                ? ` · ${article.categories.join(', ')}`
                                                : ''}
                                        </div>
                                        {article.perex && (
                                            <p className={classes.articlePerex}>{article.perex}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <p className={classes.foot}>{t('YearReview.footNote')}</p>
                </div>
            </div>
        </WidthFixer>
    )
}

export default YearReviewPanel
