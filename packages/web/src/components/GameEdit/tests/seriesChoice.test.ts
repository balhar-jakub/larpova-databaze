import { describe, expect, it } from '@jest/globals'
import { seriesChanged } from '../seriesChoice'

const existing = (id: string, name: string) => ({ id, name, amountOfGames: 3, itemLabel: `${name} (3)` })
const fresh = (name: string) => ({ name, amountOfGames: 0, itemLabel: name, isNew: true })

describe('the series choice decides whether the save changed the series', () => {
    it('reports no change when the same existing series is kept', () => {
        expect(seriesChanged(existing('7', 'Florie'), existing('7', 'Florie'))).toBe(false)
    })

    it('reports a change when another existing series is picked', () => {
        expect(seriesChanged(existing('9', 'Zlenice'), existing('7', 'Florie'))).toBe(true)
    })

    it('reports a change when a series is added to a game that had none', () => {
        expect(seriesChanged(existing('7', 'Florie'), null)).toBe(true)
    })

    it('reports a change when a series is removed', () => {
        expect(seriesChanged(null, existing('7', 'Florie'))).toBe(true)
    })

    it('reports no change when neither side has a series', () => {
        expect(seriesChanged(null, null)).toBe(false)
        expect(seriesChanged(undefined, null)).toBe(false)
    })

    it('treats a new series with the name of the stored one as a change', () => {
        // The picker offers "create new" for a name that matches nothing, but the
        // mutation still creates a series — so the toast must not claim the game
        // was left alone.
        expect(seriesChanged(fresh('Florie'), existing('7', 'Florie'))).toBe(true)
    })

    it('treats two new series with the same name as a change', () => {
        expect(seriesChanged(fresh('Florie'), fresh('Florie'))).toBe(true)
    })
})
