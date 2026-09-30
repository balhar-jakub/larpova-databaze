// Public URL shapes for the pages that are meant to be found in search.
//
// Shared by the client router (`useRoutes`) and the server-side sitemap, so the
// sitemap can never drift from the links the app actually renders. The slug is
// cosmetic — every page reads only the numeric id — but keeping it identical to
// the rendered links avoids two URLs for the same page in search results.

/** Slug generation (matches the original Java stripName). */
export const stripName = (name: string | null | undefined) =>
    (name ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/g, '')

export const gameUrl = (id: string | number, name?: string | null) => `/larp/${stripName(name)}/cs/${id}`

export const eventUrl = (id: string | number, name?: string | null) => `/event/${stripName(name)}/${id}`

export const groupUrl = (id: string | number) => `/group/${id}`

export const profileUrl = (id: string | number) => `/profile/${id}`

/**
 * Pages that carry no data of their own but are worth listing: the homepage,
 * the calendar and the ladders. Ladder keys mirror `LadderType` in useRoutes.
 */
export const staticPages = [
    '/',
    '/kalendar',
    '/games/RecentAndMostPlayed',
    '/games/MostPlayed',
    '/games/Best',
    '/games/Recent',
    '/games/MostCommented',
]

/**
 * True for paths that are the one canonical address of a page. Pages served
 * through the query form (`/gameDetail?id=…`) are deliberately excluded: their
 * pretty URL is the one to index, so they get no canonical tag at all.
 */
const CANONICAL_PATH = /^\/($|kalendar$|games\/[A-Za-z]+$|larp\/|event\/|group\/\d+$|profile\/\d+$)/

export const isCanonicalPath = (path: string) => CANONICAL_PATH.test(path.split('?')[0])
