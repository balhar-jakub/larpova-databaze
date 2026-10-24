/**
 * @jest-environment jsdom
 */
/**
 * The event detail page: renders the event header (name, date range, web,
 * loc, registration link, labels, games), the sanitized description, and
 * the edit/delete actions gated by allowedActions — delete goes through
 * the confirmation modal and lands on the homepage.
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

let eventData: Record<string, unknown> | undefined
let mutationResult: Promise<{ data?: unknown }> = Promise.resolve({ data: {} })
const mutationCalls: Array<{ variables?: Record<string, unknown> }> = []
const toasts: Array<{ text: string; type: string }> = []
let pushedRoute = ''

jest.unstable_mockModule('src/lib/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => translate(cs, key, options),
        locale: 'cs',
        ready: true,
    }),
}))
jest.unstable_mockModule('@apollo/client', () => ({
    useQuery: () => ({ data: eventData ? { eventById: eventData } : undefined, loading: false }),
    useMutation: () => [(opts: { variables?: Record<string, unknown> }) => {
        mutationCalls.push(opts)
        return mutationResult
    }, { loading: false }],
}))
jest.unstable_mockModule('is-in-browser', () => ({ __esModule: true, default: true }))
jest.unstable_mockModule('src/hooks/useShowToast', () => ({
    useShowToast: () => (text: string, type: string) => { toasts.push({ text, type }) },
}))
jest.unstable_mockModule('src/hooks/useRoutes', () => ({
    useRoutes: () => {
        const routes = {
            homepage: () => '/',
            eventEdit: (id: string) => `/udalost/upravit/${id}`,
        }
        return { ...routes, push: (url: string) => { pushedRoute = url } }
    },
}))
jest.unstable_mockModule('../../common/WidthFixer/WidthFixer', () => ({
    WidthFixer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.unstable_mockModule('../../common/OpenGraphMeta/OpenGraphMeta', () => ({ default: () => null }))
jest.unstable_mockModule('../../common/DetailGameList/DetailGameList', () => ({
    default: ({ games }: { games: Array<{ id: string; name?: string | null }> }) => (
        <div data-testid="game-list">{games.map((g) => g.name).join(', ')}</div>
    ),
}))
jest.unstable_mockModule('../../common/DetailLabelList/DetailLabelList', () => ({
    default: ({ labels }: { labels: Array<{ id: string; name?: string | null }> }) => (
        <div data-testid="label-list">{labels.map((l) => l.name).join(', ')}</div>
    ),
}))
jest.unstable_mockModule('../../common/ActionButton/ActionButton', () => ({
    default: ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
        <button type="button" onClick={onClick}>{children}</button>
    ),
}))
jest.unstable_mockModule('../../common/ConfirmationModal/ConfirmationModal', () => ({
    default: ({ show, onConfirm, onCancel }: { show: boolean; onConfirm: () => void; onCancel: () => void }) =>
        show ? (
            <div data-testid="confirm-modal">
                <button onClick={onConfirm}>confirm</button>
                <button onClick={onCancel}>cancel</button>
            </div>
        ) : null,
}))
jest.unstable_mockModule('../../common/EventRegistrationLink/EventRegistrationLink', () => ({
    default: ({ url, open }: { url?: string | null; open?: boolean }) => (
        <a href={url ?? '#'} data-testid="registration-link" data-open={String(Boolean(open))} />
    ),
}))

let EventDetailPanel: typeof import('../EventDetailPanel')['default']
let AllowedAction: typeof import('../../../graphql/__generated__/typescript-operations')['AllowedAction']

beforeAll(async () => {
    EventDetailPanel = (await import('../EventDetailPanel')).default
    AllowedAction = (await import('../../../graphql/__generated__/typescript-operations')).AllowedAction
})

beforeEach(() => {
    cleanup()
    mutationCalls.length = 0
    toasts.length = 0
    pushedRoute = ''
    mutationResult = Promise.resolve({ data: {} })
    eventData = {
        __typename: 'Event',
        id: 'e1',
        name: 'Festival LARPu',
        from: '2027-06-04T10:00:00+02:00',
        to: '2027-06-06T18:00:00+02:00',
        loc: 'Praha',
        web: 'https://festival.example.test',
        description: '<p>Největší larpový festival</p>',
        registrationUrl: 'https://reg.example.test',
        registrationOpen: true,
        labels: [{ __typename: 'Label', id: 'l1', name: 'festival' }],
        games: [{ __typename: 'Game', id: 'g1', name: 'Hra na festivalu' }],
        allowedActions: [AllowedAction.Edit, AllowedAction.Delete],
    }
})

describe('EventDetailPanel', () => {
    it('renders the event header with dates, web, loc, labels and games', () => {
        render(<EventDetailPanel eventId="e1" />)

        expect(screen.getByText('Festival LARPu')).toBeTruthy()
        expect(screen.getByTestId('label-list').textContent).toBe('festival')
        expect(screen.getByTestId('game-list').textContent).toBe('Hra na festivalu')
        expect(screen.getByTestId('registration-link').dataset.open).toBe('true')
        // The description is rendered sanitized (dangerouslySetInnerHTML).
        const html = document.body.innerHTML
        expect(html).toContain('Největší larpový festival')
    })

    it('shows the edit and delete actions when allowed', () => {
        render(<EventDetailPanel eventId="e1" />)

        fireEvent.click(screen.getByText(translate(cs, 'EventDetail.edit')))
        expect(pushedRoute).toBe('/udalost/upravit/e1')
    })

    it('hides the actions when none are allowed', () => {
        eventData = { ...eventData, allowedActions: [] }
        render(<EventDetailPanel eventId="e1" />)

        expect(screen.queryByText(translate(cs, 'EventDetail.edit'))).toBeNull()
        expect(screen.queryByText(translate(cs, 'EventDetail.delete'))).toBeNull()
    })

    it('deletes via the confirmation modal and lands on the homepage', async () => {
        render(<EventDetailPanel eventId="e1" />)

        fireEvent.click(screen.getByText(translate(cs, 'EventDetail.delete')))
        expect(screen.getByTestId('confirm-modal')).toBeTruthy()

        fireEvent.click(screen.getByText('confirm'))
        await waitFor(() => expect(pushedRoute).toBe('/'))
        expect(mutationCalls[0]?.variables).toEqual({ eventId: 'e1' })
        expect(toasts[0]?.type).toBe('success')
    })

    it('keeps the event when the delete is cancelled', () => {
        render(<EventDetailPanel eventId="e1" />)

        fireEvent.click(screen.getByText(translate(cs, 'EventDetail.delete')))
        fireEvent.click(screen.getByText('cancel'))
        expect(screen.queryByTestId('confirm-modal')).toBeNull()
        expect(mutationCalls.length).toBe(0)
    })

    it('renders a single-day event without a range', () => {
        eventData = { ...eventData, to: '2027-06-04T18:00:00+02:00' }
        render(<EventDetailPanel eventId="e1" />)

        expect(screen.getByText('Festival LARPu')).toBeTruthy()
        // Single-day events show one date only (justOneDate branch).
        expect(screen.getByTestId('game-list')).toBeTruthy()
    })

    it('renders a sparse event: no players, no games, no registration, no loc', () => {
        eventData = {
            ...eventData,
            amountOfPlayers: null,
            games: null,
            labels: null,
            registrationUrl: null,
            loc: null,
        }
        render(<EventDetailPanel eventId="e1" />)

        // No player-count line at all (the typeof guard), the games column
        // collapses, and neither loc nor registration renders.
        expect(document.body.textContent).not.toContain(translate(cs, 'EventDetail.players', { count: 0 }))
        expect(screen.getByTestId('game-list').textContent).toBe('')
        expect(screen.queryByTestId('registration-link')).toBeNull()
    })

    it('renders an event without a name (the OG-meta null arm)', () => {
        eventData = { ...eventData, name: null, description: null }
        render(<EventDetailPanel eventId="e1" />)

        expect(screen.getByTestId('game-list')).toBeTruthy()
    })

    it('renders nothing of the body when the event is missing', () => {
        eventData = undefined
        render(<EventDetailPanel eventId="e404" />)

        // The header h1 and the action buttons stay absent.
        expect(screen.queryByText('Festival LARPu')).toBeNull()
        expect(screen.queryByText(translate(cs, 'EventDetail.edit'))).toBeNull()
        expect(screen.queryByText(translate(cs, 'EventDetail.delete'))).toBeNull()
    })
})
