import { eventUrl, gameUrl, groupUrl, staticPages } from './urls'

/** The slice of the prisma client the sitemap needs — keeps it unit-testable. */
export interface SitemapPrisma {
    csld_game: {
        findMany: (args: unknown) => Promise<Array<{ id: number; name: string | null; added: Date | null }>>
    }
    event: {
        findMany: (args: unknown) => Promise<Array<{ id: number; name: string | null; from: Date | null }>>
    }
    csld_csld_group: {
        findMany: (args: unknown) => Promise<Array<{ id: number; name: string | null }>>
    }
}

/** Sitemaps are capped at 50 000 URLs; stay well below it in one file. */
const MAX_URLS = 20000

const escapeXml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')

const lastmod = (date: Date | null | undefined) =>
    date ? `<lastmod>${new Date(date).toISOString().slice(0, 10)}</lastmod>` : ''

const entry = (loc: string, date?: Date | null) =>
    `  <url><loc>${escapeXml(loc)}</loc>${lastmod(date)}</url>`

/**
 * Builds sitemap.xml from the database: the static pages, every public game,
 * event and group. Profiles are left out on purpose — thousands of thin pages
 * that say little more than a name.
 */
export const buildSitemapXml = async (prisma: SitemapPrisma, baseUrl: string): Promise<string> => {
    const [games, events, groups] = await Promise.all([
        prisma.csld_game.findMany({
            where: { deleted: false },
            select: { id: true, name: true, added: true },
            orderBy: { id: 'desc' },
            take: MAX_URLS,
        }),
        prisma.event.findMany({
            where: { deleted: false },
            select: { id: true, name: true, from: true },
            orderBy: { id: 'desc' },
            take: MAX_URLS,
        }),
        prisma.csld_csld_group.findMany({
            select: { id: true, name: true },
            orderBy: { id: 'desc' },
            take: MAX_URLS,
        }),
    ])

    const entries = [
        ...staticPages.map(page => entry(`${baseUrl}${page}`)),
        ...games.map(game => entry(`${baseUrl}${gameUrl(game.id, game.name)}`, game.added)),
        ...events.map(event => entry(`${baseUrl}${eventUrl(event.id, event.name)}`, event.from)),
        ...groups.map(group => entry(`${baseUrl}${groupUrl(group.id)}`)),
    ]

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...entries,
        '</urlset>',
        '',
    ].join('\n')
}
