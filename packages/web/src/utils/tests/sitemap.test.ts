import { jest, describe, test, expect } from '@jest/globals'

const { buildSitemapXml } = await import('../sitemap')
type SitemapPrisma = import('../sitemap').SitemapPrisma

const fakePrisma = (rows: { games?: unknown[]; events?: unknown[]; groups?: unknown[] }) => ({
    csld_game: { findMany: jest.fn(async () => rows.games ?? []) },
    event: { findMany: jest.fn(async () => rows.events ?? []) },
    csld_csld_group: { findMany: jest.fn(async () => rows.groups ?? []) },
})

const BASE = 'https://larpovadatabaze.cz'

describe('buildSitemapXml', () => {
    test('lists static pages, games, events and groups as absolute URLs', async () => {
        const prisma = fakePrisma({
            games: [{ id: 534, name: 'Ve znamení zla', added: new Date('2019-04-01T10:00:00Z') }],
            events: [{ id: 12, name: 'Keltika 2.0 — 3. běh', from: new Date('2026-10-01T00:00:00Z') }],
            groups: [{ id: 7, name: 'Tempus' }],
        })

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, BASE)

        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
        expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
        expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
        expect(xml).toContain(`<loc>${BASE}/</loc>`)
        expect(xml).toContain(`<loc>${BASE}/kalendar</loc>`)
        expect(xml).toContain(`<loc>${BASE}/larp/ve-znameni-zla/cs/534</loc><lastmod>2019-04-01</lastmod>`)
        expect(xml).toContain(`<loc>${BASE}/event/keltika-2-0-3-beh/12</loc><lastmod>2026-10-01</lastmod>`)
        expect(xml).toContain(`<loc>${BASE}/group/7</loc>`)
    })

    test('only asks for rows that are not deleted', async () => {
        const prisma = fakePrisma({})

        await buildSitemapXml(prisma as unknown as SitemapPrisma, BASE)

        expect(prisma.csld_game.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deleted: false } }))
        expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deleted: false } }))
    })

    test('covers every public game-detail URL shape the router renders', async () => {
        const prisma = fakePrisma({
            games: [{ id: 534, name: 'Ve znamení zla', added: null }],
        })

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, BASE)

        // The canonical pretty shape /larp/<slug>/cs/<id> is what the app links
        // and what next.config.mjs rewrites to /gameDetail — the sitemap must
        // list exactly that shape (measured 1 634 such URLs live on 2026-11-01).
        expect(xml).toContain(`<loc>${BASE}/larp/ve-znameni-zla/cs/534</loc>`)
        // The legacy short shape /larp/:slug/:id is an alias rewrite, not a
        // second URL to index — it must NOT appear as its own entry.
        expect(xml).not.toContain(`<loc>${BASE}/larp/ve-znameni-zla/534</loc>`)
    })

    test('escapes the host so a crafted Host header cannot break the XML', async () => {
        const prisma = fakePrisma({})

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, 'https://larp.example?a=1&b=<2>')

        expect(xml).toContain('<loc>https://larp.example?a=1&amp;b=&lt;2&gt;/</loc>')
        expect(xml).not.toContain('<2>')
    })

    test('declares the image namespace and adds no image entry without a cover', async () => {
        const prisma = fakePrisma({ events: [{ id: 12, name: 'Bez obrázku', from: null }] })

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, BASE)

        // The namespace is declared unconditionally (a sitemap without images is
        // still valid XML), but an event with no cover must not carry a broken
        // <image:image> pointing at a 400.
        expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
        expect(xml).not.toContain('<image:image>')
    })

    test('adds the event cover image as an image:image entry', async () => {
        const prisma = fakePrisma({
            events: [
                {
                    id: 2830,
                    name: 'KCD larp — 1. běh',
                    from: new Date('2027-05-13T00:00:00Z'),
                    cover_image: 4711,
                    csld_image: { id: 4711 },
                },
            ],
        })

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, BASE)

        expect(xml).toContain(`<loc>${BASE}/event/kcd-larp-1-beh/2830</loc>`)
        expect(xml).toContain(`<image:loc>${BASE}/event-image/?imageId=4711</image:loc>`)
    })

    test('falls back to the cover of a linked game when the event has none of its own', async () => {
        const prisma = fakePrisma({
            events: [
                {
                    id: 2831,
                    name: 'KCD larp — 2. běh',
                    from: null,
                    cover_image: null,
                    csld_image: null,
                    csld_game_has_event: [
                        { csld_game: { csld_image_csld_game_cover_imageTocsld_image: null } },
                        { csld_game: { csld_image_csld_game_cover_imageTocsld_image: { id: 88 } } },
                    ],
                },
            ],
        })

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, BASE)

        // The first linked game without a cover is skipped; the second one wins —
        // the same rule `resolveEventCoverImage` applies to `Event.coverImage`.
        expect(xml).toContain(`<image:loc>${BASE}/event-image/?imageId=88</image:loc>`)
    })

    test('omits the image entry for an event whose cover FK was not resolved', async () => {
        const prisma = fakePrisma({
            events: [{ id: 2832, name: 'Bez obrázku', from: null, cover_image: 12, csld_image: null }],
        })

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, BASE)

        // A raw scalar FK is not an image URL — serving it would 400 the crawler.
        expect(xml).toContain(`<loc>${BASE}/event/bez-obrazku/2832</loc>`)
        expect(xml).not.toContain('<image:image>')
    })

    test('survives a link row whose game was not resolved', async () => {
        const prisma = fakePrisma({
            events: [
                {
                    id: 2833,
                    name: 'Prázdný odkaz',
                    from: null,
                    cover_image: null,
                    csld_image: null,
                    csld_game_has_event: [null as never, { csld_game: null }],
                },
            ],
        })

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, BASE)

        // A half-loaded relation row must not throw the whole sitemap away.
        expect(xml).toContain(`<loc>${BASE}/event/prazdny-odkaz/2833</loc>`)
        expect(xml).not.toContain('<image:image>')
    })
})
