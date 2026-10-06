import { darkTheme } from '../darkTheme'

// The recommendation palette is a product decision, not an implementation
// detail: the brand red is the strongest recommendation, the light blue the
// neutral level and the grey of the old 1-3 band the strongest warning; the two
// "spíše" levels are lighter shades of those hues. Pinned here so a theme edit
// cannot change it silently.
describe('recommendation colours', () => {
    it('should keep the strongest recommendation on the brand red', () => {
        expect(darkTheme.ratingStronglyRecommended).toBe('#BD2430')
        expect(darkTheme.ratingStronglyRecommended).toBe(darkTheme.red)
    })

    it('should keep the milder recommendation a lighter red', () => {
        expect(darkTheme.ratingRecommended).toBe('#D47178')
        expect(darkTheme.ratingRecommended).not.toBe(darkTheme.ratingStronglyRecommended)
    })

    it('should keep the neutral level a light blue, not the old teal', () => {
        expect(darkTheme.ratingNeutral).toBe('#5B9BD5')
        expect(darkTheme.ratingNeutral).toBe(darkTheme.blue)
        expect(darkTheme.ratingNeutral).not.toBe(darkTheme.textGreen)
    })

    it('should keep the weaker warning a lighter grey than the stronger one', () => {
        expect(darkTheme.ratingNotRecommended).toBe('#A8A8A8')
        expect(darkTheme.ratingStronglyNotRecommended).toBe('#757575')
    })

    it('should keep the "too few ratings" state a distinct pale grey', () => {
        expect(darkTheme.ratingNotRated).toBe('#CCC')
    })

    it('should keep every level colour distinct', () => {
        const colours = [
            darkTheme.ratingStronglyRecommended,
            darkTheme.ratingRecommended,
            darkTheme.ratingNeutral,
            darkTheme.ratingNotRecommended,
            darkTheme.ratingStronglyNotRecommended,
            darkTheme.ratingNotRated,
        ]

        expect(new Set(colours).size).toBe(colours.length)
    })
})
