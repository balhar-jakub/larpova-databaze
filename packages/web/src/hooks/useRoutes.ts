import { useRouter } from 'next/router'
import { useMemo } from 'react'

// ── Slug generation (matches Java stripName) ──────────────

const stripName = (name: string | null | undefined) =>
    (name ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/g, '')

const getGameRoute = (id: string, name?: string | null) =>
  `/larp/${stripName(name)}/cs/${id}`

const getEventRoute = (id: string, name?: string | null) =>
  `/event/${stripName(name)}/${id}`

// ── Route helper ──────────────────────────────────────────

export interface Route {
  readonly href: string
  readonly as: string
}

function route(href: string, as?: string): Route {
  return { href, as: as ?? href }
}

// ── LadderType enum (inlined from generated types) ───────

export enum LadderType {
  RecentAndMostPlayed = 'RecentAndMostPlayed',
  MostPlayed = 'MostPlayed',
  Recent = 'Recent',
  Best = 'Best',
  MostCommented = 'MostCommented',
}

// ── Hook ──────────────────────────────────────────────────

export const useRoutes = () => {
    const router = useRouter()

    return useMemo(
        () => ({
            push: (r: Route) => router.push(r.href, r.as),

            homepage: (): Route => route('/'),

            gameDetail: (id: string, name?: string | null): Route => {
              const as = getGameRoute(id, name)
              return route(`/gameDetail?id=${id}`, as)
            },

            eventDetail: (id: string, name?: string | null): Route => {
              const as = getEventRoute(id, name)
              return route(`/eventDetail?id=${id}`, as)
            },

            groupDetail: (id: string): Route =>
              route(`/groupDetail?id=${id}`, `/group/${id}`),

            games: (
                ladderType: LadderType = LadderType.RecentAndMostPlayed,
            ): Route =>
              route(`/games?ladderType=${ladderType}`, `/games/${ladderType}`),

            calendar: (): Route => route('/kalendar'),

            currentProfile: (): Route =>
              route('/profile?id=current', '/profile/current'),

            userProfile: (id: string): Route =>
              route(`/profile?id=${id}`, `/profile/${id}`),

            userSettings: (): Route =>
              route('/profile?id=settings', '/profile/settings'),

            changePassword: (): Route =>
              route('/profile?id=changePassword', '/profile/changePassword'),

            recoverPasswordStart: (): Route => route('/recoverPassword'),

            signIn: (): Route => route('/signIn'),

            signUp: (): Route => route('/signUp'),

            gameCreate: (): Route => route('/gameEdit'),

            gameEdit: (id: string): Route =>
              route(`/gameEdit?id=${id}`, `/gameEdit/${id}`),

            eventCreate: (): Route => route('/eventEdit'),

            eventEdit: (id: string): Route =>
              route(`/eventEdit?id=${id}`, `/eventEdit/${id}`),

            adminIntro: (): Route => route('/admin'),

            adminUsers: (): Route => route('/admin/users'),

            adminLabels: (): Route => route('/admin/labels'),

            adminStats: (): Route => route('/admin/stats'),

            adminSelfRated: (): Route => route('/admin/selfRated'),

            search: (initialQuery?: string): Route =>
              route(initialQuery ? `/search?initialQuery=${encodeURIComponent(initialQuery)}` : '/search'),
        }),
        [router],
    )
}
