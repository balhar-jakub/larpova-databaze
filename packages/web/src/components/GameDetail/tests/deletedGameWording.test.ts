import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The user-visible half of the soft delete: the notice that tells an editor the
 * game is deleted, the button that brings it back and the page a visitor gets
 * instead of the deleted game. The keys are asserted against the shipped
 * locales, not a fixture, because a missing key renders as its own name
 * (`GameDetail.restoreGame`) — or as nothing at all — and the editor is left with
 * no way back from a delete that cannot be undone.
 */

const locales = ['cs', 'en'] as const
const required = ['restoreGame', 'gameRestored', 'gameNotFound', 'deletedGameNotice'] as const

const load = (locale: string) =>
    JSON.parse(
        readFileSync(
            fileURLToPath(new URL(`../../../../public/static/locales/${locale}/common.json`, import.meta.url)),
            'utf-8',
        ),
    ) as { GameDetail?: Record<string, string> }

describe.each(locales)('the %s locale', locale => {
    const data = load(locale)

    test.each(required)('GameDetail.%s is a real translation', key => {
        expect(typeof data.GameDetail?.[key]).toBe('string')
        expect(data.GameDetail?.[key].length ?? 0).toBeGreaterThan(0)
    })

    test('the notice says the game is deleted', () => {
        expect(data.GameDetail?.deletedGameNotice).toMatch(/smazan|deleted/i)
    })
})
