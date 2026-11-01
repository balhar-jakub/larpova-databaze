import { describe, test, expect } from '@jest/globals'

const { buildRobotsTxt, isIndexableHost, BLOCKED_CRAWLERS } = await import('../robotsTxt')

describe('isIndexableHost', () => {
  test('only the production domain is indexable', () => {
    expect(isIndexableHost('larpovadatabaze.cz')).toBe(true)
    expect(isIndexableHost('www.larpovadatabaze.cz')).toBe(true)
    expect(isIndexableHost('csld.vezlute.cz')).toBe(false)
    expect(isIndexableHost('ples.vezlute.cz')).toBe(false)
    expect(isIndexableHost('localhost')).toBe(false)
  })
})

describe('buildRobotsTxt', () => {
  test('non-indexable hosts get a blanket Disallow and no sitemap', () => {
    const txt = buildRobotsTxt('csld.vezlute.cz')
    expect(txt).toBe('User-agent: *\nDisallow: /\n')
    expect(txt).not.toContain('Sitemap:')
  })

  test('production host allows crawling but disallows /admin and /graphql, and keeps the sitemap line', () => {
    const txt = buildRobotsTxt('larpovadatabaze.cz')
    expect(txt).toContain('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /graphql')
    expect(txt).toContain('Sitemap: https://larpovadatabaze.cz/sitemap.xml')
  })

  test('AhrefsBot and PetalBot/PetalSearch are disallowed (2026-11-01 audit follow-up)', () => {
    const txt = buildRobotsTxt('larpovadatabaze.cz')
    for (const agent of ['AhrefsBot', 'PetalBot', 'PetalSearch', 'BLEXBot']) {
      expect(txt).toContain(`User-agent: ${agent}\nDisallow: /`)
      expect(BLOCKED_CRAWLERS).toContain(agent)
    }
  })

  test('every blocked crawler gets its own User-agent group', () => {
    const txt = buildRobotsTxt('larpovadatabaze.cz')
    for (const agent of BLOCKED_CRAWLERS) {
      expect(txt).toContain(`User-agent: ${agent}`)
    }
    // one Disallow per blocked agent
    const groups = txt.split('\n\n').filter((g) => g.startsWith('User-agent:') && !g.startsWith('User-agent: *'))
    expect(groups).toHaveLength(BLOCKED_CRAWLERS.length)
    for (const g of groups) expect(g).toMatch(/Disallow: \/$/)
  })
})
