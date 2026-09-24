import { darkTheme } from '../darkTheme'

// The recommendation palette is a product decision, not an implementation
// detail: red = Doporučuji, light blue = Neutrální, and the grey that used to
// mean "rated under 4" = Nedoporučuji. Pinned here so a theme edit cannot
// change it silently.
describe('recommendation colours', () => {
    it('should keep Doporučuji on the brand red', () => {
        expect(darkTheme.ratingGreat).toBe('#BD2430')
        expect(darkTheme.ratingGreat).toBe(darkTheme.red)
    })

    it('should keep Neutrální a light blue, not the old teal', () => {
        expect(darkTheme.ratingAverage).toBe('#5B9BD5')
        expect(darkTheme.ratingAverage).not.toBe(darkTheme.textGreen)
    })

    it('should keep Nedoporučuji on the grey of the old 1-3 band', () => {
        expect(darkTheme.ratingMediocre).toBe('#757575')
    })

    it('should keep the "too few ratings" state a distinct pale grey', () => {
        expect(darkTheme.ratingNotRated).toBe('#CCC')
    })
})
