/**
 * @jest-environment jsdom
 */
/**
 * The events tab of the unified search: results list with rows, the
 * empty-state with the suggestion callback, and the pager.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { translate } from 'src/lib/translationLookup'

const cs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../public/static/locales/cs/common.json', import.meta.url)), 'utf-8'),
)

;(globalThis as unknown as { require: (p: string) => unknown }).require = () => ({})

let eventsPage: { events: unknown[]; totalAmount: number; suggestion?: string; duplicates?: unknown[] } | undefined
const queryVariables: Array<Record<string, unknown>> = []
const suggestionsUsed: string[] = []

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: (gql: unknown, opts: { variables?: Record<string, unknown>; onCompleted?: (d: unknown) => void }) => {
        queryVariables.push(opts.variables ?? {})
        // Defer onCompleted out of the render pass (setState-in-render guard).
        Promise.resolve().then(() => opts.onCompleted?.({ eventsByQuery: eventsPage }))
        return { loading: false }
    },
}))
jest.unstable_mockModule('../../common/BigLoading/BigLoading', () => ({ default: () => <div>loading</div> }))
jest.unstable_mockModule('../../common/Pager/Pager', () => ({
    default: ({ currentOffset, pageSize, totalAmount, onOffsetChanged }: { currentOffset: number; pageSize: number; totalAmount: number; onOffsetChanged: (o: number) => void }) => (
        <div data-testid="pager" data-offset={String(currentOffset)} data-total={String(totalAmount)}>
            <button type="button" onClick={() => onOffsetChanged(pageSize)}>next</button>
        </div>
    ),
}))
jest.unstable_mockModule('../SearchSuggestion', () => ({
    default: ({ suggestion, onUse }: { suggestion?: string | null; onUse: (s: string) => void }) => (
        <button type="button" onClick={() => onUse(suggestion ?? 'navrh')}>use-suggestion</button>
    ),
}))
jest.unstable_mockModule('../SearchEventRow', () => ({
    default: ({ event }: { event: { id: string; name?: string | null } }) => (
        <div data-testid={`event-row-${event.id}`}>{event.name}</div>
    ),
}))

let EventsSearchPanel: typeof import('../EventsSearchPanel')['default']

beforeAll(async () => {
    EventsSearchPanel = (await import('../EventsSearchPanel')).default
})

beforeEach(() => {
    cleanup()
    queryVariables.length = 0
    suggestionsUsed.length = 0
    eventsPage = {
        events: [
            { __typename: 'Event', id: 'e1', name: 'Festival=jeden' },
            { __typename: 'Event', id: 'e2', name: 'Festival=dva' },
        ],
        totalAmount: 25,
        suggestion: 'navrh',
        duplicates: [],
    }
})

describe('EventsSearchPanel', () => {
    it('renders the event rows and the pager with the total', async () => {
        render(<EventsSearchPanel query="festival" onUseSuggestion={(s) => suggestionsUsed.push(s)} />)

        expect(await screen.findByTestId('event-row-e1')).toBeTruthy()
        expect(screen.getByTestId('event-row-e2')).toBeTruthy()
        expect(screen.getByTestId('pager').dataset.total).toBe('25')
        expect(queryVariables[0]).toMatchObject({ query: 'festival', limit: 20 })
    })

    it('offers the suggestion in the empty state', async () => {
        eventsPage = { events: [], totalAmount: 0, suggestion: 'navrh', duplicates: [] }
        render(<EventsSearchPanel query="neznamy-vyraz" onUseSuggestion={(s) => suggestionsUsed.push(s)} />)

        fireEvent.click(await screen.findByText('use-suggestion'))
        expect(suggestionsUsed).toEqual(['navrh'])
    })

    it('keeps the pager on the next offset page', async () => {
        render(<EventsSearchPanel query="festival" onUseSuggestion={(s) => suggestionsUsed.push(s)} />)
        await screen.findByTestId('pager')

        fireEvent.click(screen.getByText('next'))
        await waitFor(() => expect(screen.getByTestId('pager').dataset.offset).toBe('20'))
    })
})
