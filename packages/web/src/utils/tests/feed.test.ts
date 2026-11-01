import { jest, describe, test, expect } from '@jest/globals'

const { buildFeedXml } = await import('../feed')
type FeedPrisma = import('../feed').FeedPrisma

const fakePrisma = (rows: { games?: unknown[]; articles?: unknown[] }) => ({
    csld_game: { findMany: jest.fn(async () => rows.games ?? []) },
    csld_article: { findMany: jest.fn(async () => rows.articles ?? []) },
})

const BASE = 'https://larpovadatabaze.cz'

describe('buildFeedXml', () => {
    test('emits a valid RSS 2.0 skeleton with channel metadata', async () => {
        const prisma = fakePrisma({})

        const xml = await buildFeedXml(prisma as unknown as FeedPrisma, BASE)

        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
        expect(xml).toContain('<rss version="2.0">')
        expect(xml.trimEnd().endsWith('</rss>'))
        expect(xml).toContain('<title>Larpová databáze</title>')
        expect(xml).toContain(`<link>${BASE}</link>`)
        expect(xml).toContain('<language>cs</language>')
        expect(xml).toMatch(/<lastBuildDate>.+<\/lastBuildDate>/)
    })

    test('lists recent games with in-app links and recent articles with external links', async () => {
        const prisma = fakePrisma({
            games: [
                { id: 534, name: 'Ve znamení zla', added: new Date('2026-10-20T10:00:00Z'), web: 'https://example.test/hra' },
                { id: 99, name: null, added: null, web: null },
            ],
            articles: [
                { id: 7, title: 'Reportáž z akce', url: 'https://larpy.cz/reportaz', perex: '<p>Krátký <b>souhrn</b></p>', authors: 'Ondřej Novák', published_at: new Date('2026-10-25T08:30:00Z'), fetched_at: new Date('2026-10-25T09:00:00Z') },
            ],
        })

        const xml = await buildFeedXml(prisma as unknown as FeedPrisma, BASE)

        // game item: pretty in-app URL as link and guid, pubDate from `added`
        expect(xml).toContain(`<link>${BASE}/larp/ve-znameni-zla/cs/534</link>`)
        expect(xml).toContain(`<guid isPermaLink="true">${BASE}/larp/ve-znameni-zla/cs/534</guid>`)
        expect(xml).toContain('<title>Ve znamení zla</title>')
        expect(xml).toContain('<pubDate>Tue, 20 Oct 2026 10:00:00 +0000</pubDate>')
        expect(xml).toContain('<description>https://example.test/hra</description>')

        // unnamed, undated game still gets an item with a fallback title and no pubDate
        expect(xml).toContain('<title>Hra 99</title>')

        // article item: external URL, HTML-stripped perex, author, pubDate
        expect(xml).toContain('<link>https://larpy.cz/reportaz</link>')
        expect(xml).toContain('<title>Reportáž z akce</title>')
        expect(xml).toContain('<description>Krátký souhrn</description>')
        expect(xml).toContain('<author>Ondřej Novák</author>')
        expect(xml).toContain('<pubDate>Sun, 25 Oct 2026 08:30:00 +0000</pubDate>')
    })

    test('asks only for games that are not deleted (NULL means not deleted)', async () => {
        const prisma = fakePrisma({})

        await buildFeedXml(prisma as unknown as FeedPrisma, BASE)

        expect(prisma.csld_game.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { OR: [{ deleted: false }, { deleted: null }] } }),
        )
    })

    test('escapes XML-special characters in titles, hosts and perexes', async () => {
        const prisma = fakePrisma({
            games: [{ id: 1, name: 'A & B <test> "quoted"', added: new Date('2026-01-01T00:00:00Z'), web: null }],
            articles: [{ id: 2, title: 'C & D', url: 'https://x.test/?a=1&b=<2>', perex: 'x & <y>', authors: null, published_at: null, fetched_at: new Date('2026-01-02T00:00:00Z') }],
        })

        const xml = await buildFeedXml(prisma as unknown as FeedPrisma, 'https://h.test?a=1&b=<2>')

        expect(xml).toContain('<title>A &amp; B &lt;test&gt; &quot;quoted&quot;</title>')
        expect(xml).toContain('<link>https://x.test/?a=1&amp;b=&lt;2&gt;</link>')
        expect(xml).toContain('<description>x &amp;</description>')
        expect(xml).toContain(`<link>https://h.test?a=1&amp;b=&lt;2&gt;</link>`)
        expect(xml).not.toContain('<2>')
    })
})
