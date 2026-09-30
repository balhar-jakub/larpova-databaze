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
        expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
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

    test('escapes the host so a crafted Host header cannot break the XML', async () => {
        const prisma = fakePrisma({})

        const xml = await buildSitemapXml(prisma as unknown as SitemapPrisma, 'https://larp.example?a=1&b=<2>')

        expect(xml).toContain('<loc>https://larp.example?a=1&amp;b=&lt;2&gt;/</loc>')
        expect(xml).not.toContain('<2>')
    })
})
