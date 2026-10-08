import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { eventUrl, gameUrl } from '../utils/urls'
import { SearchType, TYPE_PARAM } from '../components/Search/searchHelpers'

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
              const as = gameUrl(id, name)
              return route(`/gameDetail?id=${id}`, as)
            },

            eventDetail: (id: string, name?: string | null): Route => {
              const as = eventUrl(id, name)
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

            /**
             * The unified search page: `?q=larp&typ=udalosti`. The kind of result
             * used to travel as `t=` with the two letters that stood for the tab
             * it selected (`t=users`); the page has four kinds of result now
             * (groups included) and shows them all at once, so the parameter is
             * spelled out and only ever narrows the page to one kind.
             */
            search: (query?: string, type?: SearchType): Route => {
              const params: string[] = []
              if (query) params.push(`q=${encodeURIComponent(query)}`)
              if (type) params.push(`typ=${TYPE_PARAM[type]}`)
              return route(params.length ? `/search?${params.join('&')}` : '/search')
            },

            /** "Hry od X" — the catalog, filtered to one author. */
            gamesOfAuthor: (id: string, name?: string | null): Route => {
              const params = [`autor=${encodeURIComponent(id)}`]
              if (name) params.push(`autorn=${encodeURIComponent(name)}`)
              return route(`/games?${params.join('&')}`)
            },
        }),
        [router],
    )
}
