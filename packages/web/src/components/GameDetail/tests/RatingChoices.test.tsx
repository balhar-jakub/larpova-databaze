/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'

const mutate = jest.fn()

const translations: Record<string, string> = {
    'GameDetail.rate': 'Vaše hodnocení je:',
    'Rating.recommended': 'Doporučuji',
    'Rating.neutral': 'Neutrální',
    'Rating.notRecommended': 'Nedoporučuji',
}

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => translations[key] ?? key }),
}))

jest.unstable_mockModule('@apollo/client', () => ({
    useApolloClient: () => ({ mutate }),
}))

// Components pull their GraphQL documents in with require() — webpack resolves
// those through next-plugin-graphql. ESM-based jest has no require, so give the
// module a minimal one before importing it; the document itself only ever
// reaches the mocked Apollo client, so an empty object is enough.
;(globalThis as unknown as { require: (path: string) => unknown }).require = () => ({})

let RatingChoices: typeof import('../RatingChoices').default

beforeAll(async () => {
    RatingChoices = (await import('../RatingChoices')).default
})

describe('RatingChoices', () => {
    beforeEach(() => {
        mutate.mockClear()
    })

    it('offers the three recommendations instead of stars', async () => {
        render(<RatingChoices gameId="42" rating={0} />)

        const buttons = await screen.findAllByRole('button')
        expect(buttons.map(button => button.textContent)).toEqual(['Doporučuji', 'Neutrální', 'Nedoporučuji'])
    })

    it('marks the band of the stored rating as pressed', async () => {
        render(<RatingChoices gameId="42" rating={5} />)

        expect((await screen.findByRole('button', { name: /Neutrální/ })).getAttribute('aria-pressed')).toBe('true')
        expect(screen.getByRole('button', { name: /Doporučuji/ }).getAttribute('aria-pressed')).toBe('false')
        expect(screen.getByRole('button', { name: /Nedoporučuji/ }).getAttribute('aria-pressed')).toBe('false')
    })

    it('treats an old star rating as the band it falls into', async () => {
        // 7 was stored while the input was ten stars; that is still "Neutrální".
        render(<RatingChoices gameId="42" rating={7} />)

        expect((await screen.findByRole('button', { name: /Neutrální/ })).getAttribute('aria-pressed')).toBe('true')
    })

    it('stores the 1-10 value that belongs to the picked band', async () => {
        render(<RatingChoices gameId="42" rating={0} />)

        fireEvent.click(await screen.findByRole('button', { name: /Doporučuji/ }))
        await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        expect((mutate.mock.calls[0] as any)[0].variables).toEqual({ gameId: '42', rating: 10 })
    })

    it('stores the middle value for the neutral choice', async () => {
        render(<RatingChoices gameId="42" rating={0} />)

        fireEvent.click(await screen.findByRole('button', { name: /Neutrální/ }))
        await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        expect((mutate.mock.calls[0] as any)[0].variables).toEqual({ gameId: '42', rating: 5 })
    })

    it('does not re-send a rating that is already stored', async () => {
        render(<RatingChoices gameId="42" rating={10} />)

        fireEvent.click(await screen.findByRole('button', { name: /Doporučuji/ }))
        await new Promise(resolve => {
            setTimeout(resolve, 0)
        })
        expect(mutate).not.toHaveBeenCalled()
    })
})
