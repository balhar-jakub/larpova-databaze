import { describe, test, expect } from '@jest/globals'

const { stripName, gameUrl, eventUrl, groupUrl, profileUrl, isCanonicalPath, staticPages } = await import('../urls')

describe('stripName', () => {
    test('matches the slug shapes the app renders', () => {
        expect(stripName('De la Bête')).toBe('de-la-bete')
        expect(stripName('Křížová výprava chudiny 1096 - premium')).toBe('krizova-vyprava-chudiny-1096-premium')
        expect(stripName('Bitva pěti armád [B5A, 2015]')).toBe('bitva-peti-armad-b5a-2015')
    })

    test('survives a missing name', () => {
        expect(stripName(null)).toBe('')
        expect(stripName(undefined)).toBe('')
    })
})

describe('detail URLs', () => {
    test('keep the shapes the router renders', () => {
        expect(gameUrl('388', 'De la Bête')).toBe('/larp/de-la-bete/cs/388')
        expect(gameUrl(388, null)).toBe('/larp//cs/388')
        expect(eventUrl(12, 'Keltika 2.0 — 3. běh')).toBe('/event/keltika-2-0-3-beh/12')
        expect(groupUrl(7)).toBe('/group/7')
        expect(profileUrl(9)).toBe('/profile/9')
    })
})

describe('isCanonicalPath', () => {
    test('accepts the query-free addresses', () => {
        expect(isCanonicalPath('/')).toBe(true)
        expect(isCanonicalPath('/kalendar')).toBe(true)
        expect(isCanonicalPath('/games/Best')).toBe(true)
        expect(isCanonicalPath('/larp/de-la-bete/cs/388')).toBe(true)
        expect(isCanonicalPath('/event/keltika-2-0-3-beh/12')).toBe(true)
        expect(isCanonicalPath('/group/7')).toBe(true)
        expect(isCanonicalPath('/profile/9')).toBe(true)
    })

    test('rejects the query forms so variants never collapse onto one URL', () => {
        expect(isCanonicalPath('/gameDetail?id=388')).toBe(false)
        expect(isCanonicalPath('/eventDetail?id=12')).toBe(false)
        expect(isCanonicalPath('/groupDetail?id=7')).toBe(false)
        expect(isCanonicalPath('/profile?id=9')).toBe(false)
        expect(isCanonicalPath('/profile/settings')).toBe(false)
        expect(isCanonicalPath('/games?ladderType=Best')).toBe(false)
    })
})

describe('staticPages', () => {
    test('are rooted paths', () => {
        expect(staticPages.length).toBeGreaterThan(0)
        expect(staticPages.every(page => page.startsWith('/'))).toBe(true)
    })
})
