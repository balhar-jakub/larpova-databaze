import { gameUrl } from './urls'

/** The slice of the prisma client the feed needs — keeps it unit-testable. */
export interface FeedPrisma {
    csld_game: {
        findMany: (args: unknown) => Promise<Array<{ id: number; name: string | null; added: Date | null; web: string | null }>>
    }
    csld_article: {
        findMany: (args: unknown) => Promise<Array<{
            id: number
            title: string
            url: string
            perex: string | null
            authors: string | null
            published_at: Date | null
            fetched_at: Date
        }>>
    }
}

/** How many entries of each kind the feed carries. */
const FEED_LIMIT = 30

const escapeXml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')

/** RFC-822 date, the format RSS 2.0 readers expect in <pubDate>. */
const rfc822 = (date: Date) =>
    date.toUTCString().replace('GMT', '+0000')

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Builds an RSS 2.0 feed of the most recently added games and the most recently
 * published articles. Game entries link to the in-app game page; article
 * entries link to the external source URL (the articles are imported from
 * larpy.cz / larp.cz and live off-site).
 */
export const buildFeedXml = async (prisma: FeedPrisma, baseUrl: string): Promise<string> => {
    const [games, articles] = await Promise.all([
        prisma.csld_game.findMany({
            where: {
                OR: [{ deleted: false }, { deleted: null }],
            },
            select: { id: true, name: true, added: true, web: true },
            orderBy: { added: 'desc' },
            take: FEED_LIMIT,
        }),
        prisma.csld_article.findMany({
            select: { id: true, title: true, url: true, perex: true, authors: true, published_at: true, fetched_at: true },
            orderBy: { published_at: 'desc' },
            take: FEED_LIMIT,
        }),
    ])

    const gameItems = games.map(game => {
        const title = game.name ?? `Hra ${game.id}`
        const link = `${baseUrl}${gameUrl(game.id, game.name)}`
        const description = game.web ? escapeXml(game.web) : ''
        const pubDate = game.added ? `<pubDate>${rfc822(new Date(game.added))}</pubDate>` : ''
        return [
            '    <item>',
            `      <title>${escapeXml(title)}</title>`,
            `      <link>${escapeXml(link)}</link>`,
            `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
            description ? `      <description>${description}</description>` : '',
            pubDate,
            '    </item>',
        ].filter(Boolean).join('\n')
    })

    const articleItems = articles.map(article => {
        const description = article.perex ? escapeXml(stripHtml(article.perex)) : ''
        const author = article.authors ? `<author>${escapeXml(article.authors)}</author>` : ''
        const date = article.published_at ?? article.fetched_at
        return [
            '    <item>',
            `      <title>${escapeXml(article.title)}</title>`,
            `      <link>${escapeXml(article.url)}</link>`,
            `      <guid isPermaLink="true">${escapeXml(article.url)}</guid>`,
            description ? `      <description>${description}</description>` : '',
            author,
            `      <pubDate>${rfc822(new Date(date))}</pubDate>`,
            '    </item>',
        ].filter(Boolean).join('\n')
    })

    // Games first, then articles; each list is already date-ordered.
    const items = [...gameItems, ...articleItems]

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        '  <channel>',
        '    <title>Larpová databáze</title>',
        `    <link>${escapeXml(baseUrl)}</link>`,
        '    <description>Nové hry a články z larpovadatabaze.cz</description>',
        '    <language>cs</language>',
        `    <lastBuildDate>${rfc822(new Date())}</lastBuildDate>`,
        ...items,
        '  </channel>',
        '</rss>',
        '',
    ].join('\n')
}
