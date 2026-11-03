import { eventUrl, gameUrl, groupUrl, staticPages } from './urls'

/** A row shape the sitemap reads; kept loose so the tests can fake it. */
interface EventRow {
    id: number
    name: string | null
    from: Date | null
    cover_image?: number | null
    csld_image?: { id: number } | null
    csld_game_has_event?: Array<{
        csld_game?: { csld_image_csld_game_cover_imageTocsld_image?: { id: number } | null } | null
    }>
}

/** The slice of the prisma client the sitemap needs — keeps it unit-testable. */
export interface SitemapPrisma {
    csld_game: {
        findMany: (args: unknown) => Promise<Array<{ id: number; name: string | null; added: Date | null }>>
    }
    event: {
        findMany: (args: unknown) => Promise<EventRow[]>
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

/**
 * The image a crawler should show next to an event URL: the event's own cover
 * when it has one, otherwise the cover of the first linked game that has one —
 * the same fallback `resolveEventCoverImage` applies to `Event.coverImage`, so
 * the sitemap and the page never disagree about whether an event has a picture.
 * Only the ids the caller actually included are read: a raw row carries the
 * scalar FK (`cover_image: 12`), which is not an image URL.
 */
const eventCoverImageId = (event: EventRow): number | undefined => {
    if (event.csld_image) return event.csld_image.id
    if (typeof event.cover_image === 'number') return undefined
    for (const link of event.csld_game_has_event ?? []) {
        const cover = link?.csld_game?.csld_image_csld_game_cover_imageTocsld_image
        if (cover) return cover.id
    }
    return undefined
}

const imageEntry = (url: string) => `  <image:image><image:loc>${escapeXml(url)}</image:loc></image:image>`

const entry = (loc: string, date?: Date | null, images: string[] = []) =>
    [
        `  <url><loc>${escapeXml(loc)}</loc>${lastmod(date)}`,
        ...images.map(imageEntry),
        '</url>',
    ].join('')

/**
 * Builds sitemap.xml from the database: the static pages, every public game,
 * event and group. Profiles are left out on purpose — thousands of thin pages
 * that say little more than a name.
 *
 * Events carry their cover image as an `<image:image>` entry: the calendar is
 * the second most visited page and Google Images is a real entry point for
 * "larp akce", so an event with a poster should be discoverable as a picture
 * and not only as a URL.
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
            select: {
                id: true,
                name: true,
                from: true,
                cover_image: true,
                csld_image: { select: { id: true } },
                csld_game_has_event: {
                    select: {
                        csld_game: {
                            select: {
                                csld_image_csld_game_cover_imageTocsld_image: { select: { id: true } },
                            },
                        },
                    },
                },
            },
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
        ...events.map(event => {
            const imageId = eventCoverImageId(event)
            return entry(
                `${baseUrl}${eventUrl(event.id, event.name)}`,
                event.from,
                imageId === undefined ? [] : [`${baseUrl}/event-image/?imageId=${imageId}`],
            )
        }),
        ...groups.map(group => entry(`${baseUrl}${groupUrl(group.id)}`)),
    ]

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        ...entries,
        '</urlset>',
        '',
    ].join('\n')
}
