import { AllowedAction } from 'src/graphql/__generated__/typescript-operations'
import { canDelete, canEdit, isGameMissing } from '../graphqlUtils'

/**
 * The two decisions the game detail page makes about a game it just read, kept
 * as pure functions so the rules are asserted without rendering the page.
 *
 * A soft-deleted game is the interesting case: `Game.allowedActions` reports
 * only `Edit` for it (deleting it again is a no-op) and the panel shows the
 * Restore button instead of the Delete one, so a regression in either half turns
 * the buttons into a way to do nothing. And `gameById` answering null must hide
 * the game even though the cached fragment still holds it — that is exactly how
 * "delete said it worked" left the game on its own URL.
 */

describe('game detail actions', () => {
    test('a deleted game offers edit, not delete — Restore replaces it', () => {
        expect(canEdit([AllowedAction.Edit])).toBe(true)
        expect(canDelete([AllowedAction.Edit])).toBe(false)
    })

    test('a live game an editor may remove offers both', () => {
        expect(canEdit([AllowedAction.Edit, AllowedAction.Delete])).toBe(true)
        expect(canDelete([AllowedAction.Edit, AllowedAction.Delete])).toBe(true)
    })

    test('a visitor who may not touch the game is offered nothing', () => {
        expect(canEdit([])).toBe(false)
        expect(canDelete([])).toBe(false)
        expect(canEdit(undefined)).toBeFalsy()
        expect(canDelete(undefined)).toBeFalsy()
    })
})

describe('isGameMissing', () => {
    test('a null gameById means the game is gone once the query settled', () => {
        expect(isGameMissing(false, { gameById: null })).toBe(true)
    })

    test('the cached fragment must not keep a deleted game on screen', () => {
        // The fragment above the check still holds the game Apollo cached from an
        // earlier visit; the network answer is what decides, so the same `null`
        // hides it whether or not the cache has data.
        expect(isGameMissing(false, { gameById: null })).toBe(true)
        // ... and an answer that never arrived (still loading) is not "missing".
        expect(isGameMissing(true, { gameById: null })).toBe(false)
        expect(isGameMissing(true, undefined)).toBe(false)
    })

    test('a game that came back is not missing', () => {
        expect(isGameMissing(false, { gameById: { id: '1' } })).toBe(false)
    })

    test('a query that never answered at all is missing', () => {
        expect(isGameMissing(false, undefined)).toBe(true)
        expect(isGameMissing(false, null)).toBe(true)
    })
})
