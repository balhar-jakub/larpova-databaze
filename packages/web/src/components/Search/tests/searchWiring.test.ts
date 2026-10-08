import fs from 'fs'
import path from 'path'

/**
 * The search is wired in five places at once and they have to agree: the header
 * field, the search page (one page for four kinds of result, the query and the
 * picked kind in the URL), the events list, the calendar filter, the catalog
 * filter — and the resolver *tree the app really runs*, which is
 * packages/web/src/api/src (packages/api/src is the copy the tests use). A
 * change that lands in one of them and not the others is exactly how the header
 * field ended up searching games only.
 */
const web = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8')

const searchPanel = () => web('src/components/Search/SearchPanel.tsx')
const headerForm = () => web('src/components/common/PageHeader/HeaderSearchForm.tsx')
const searchPage = () => web('pages/search/index.tsx')

describe('the search page offers every kind of result on one page', () => {
    it('lists the four kinds without a tab hiding three of them', () => {
        const source = searchPanel()

        expect(source).toMatch(/SEARCH_TYPES/)
        expect(source).toMatch(/<SearchTypeChips/)
        expect(source).toMatch(/<SearchSectionHeader/)
        expect(source).toMatch(/bestMatches</)
        for (const panel of ['GamesSearchPanel', 'UserSearchPanel', 'EventsSearchPanel', 'GroupsSearchPanel']) {
            expect(source).toMatch(new RegExp(`<${panel}`))
        }
        // Tabs are gone: the kind of result is a filter that narrows this page.
        expect(source).not.toMatch(/<Tabs</)
    })

    it('keeps the query and the picked kind in the URL', () => {
        expect(searchPage()).toMatch(/router\.query\.q/)
        expect(searchPage()).toMatch(/router\.query\.typ/)
        expect(searchPanel()).toMatch(/searchQueryParams\(/)
        expect(web('src/components/Search/searchHelpers.ts')).toMatch(/typ: TYPE_PARAM\[type\]/)
        // The old links carried `t=users`; they still resolve.
        expect(searchPage()).toMatch(/router\.query\.t as string/)
    })

    it('says why a one letter query searches nothing', () => {
        expect(searchPanel()).toMatch(/componentTestIds\.search\.tooShort/)
    })

    it('offers the corrected query when nothing was found', () => {
        expect(searchPanel()).toMatch(/onUseSuggestion/)
        expect(web('src/components/Search/SearchSuggestion.tsx')).toMatch(/Search\.didYouMean/)
    })

    it('offers the other kinds when the picked one is empty', () => {
        expect(searchPanel()).toMatch(/componentTestIds\.search\.emptyType\(selectedType\)/)
        expect(searchPanel()).toMatch(/componentTestIds\.search\.emptyLink\(type\)/)
    })
})

describe('every row says what the engine matched', () => {
    it('the overview asks for all four kinds and their counts in one query', () => {
        const document = web('src/components/Search/graphql/searchOverview.graphql')

        expect(document).toMatch(/search\(query: \$query, limit: \$limit\)/)
        ;['totalGames', 'totalUsers', 'totalEvents', 'totalGroups', 'suggestion'].forEach((field) => {
            expect(document).toMatch(new RegExp(`\\b${field}\\b`))
        })
    })

    it('a game row can name the author or the group it was found by', () => {
        // 55 of the 121 games a `larp` query returns carry no `larp` in the name.
        expect(web('src/components/Search/SearchGameRow.tsx')).toMatch(/gameMatchReason/)
        expect(web('src/components/Search/graphql/searchGameData.graphql')).toMatch(/authors \{/)
        expect(web('src/components/Search/graphql/searchGameData.graphql')).toMatch(/groupAuthor \{/)
    })

    it('the events list asks for a date range and for the duplicate counts', () => {
        const document = web('src/components/Search/graphql/searchPageEvents.graphql')

        expect(document).toMatch(/\$from: String, \$to: String/)
        expect(document).toMatch(/from: \$from, to: \$to/)
        expect(document).toMatch(/duplicates \{/)
        // The calendar card has no date on it — the search row has to add one.
        expect(web('src/components/Search/SearchEventRow.tsx')).toMatch(/eventDateLabel/)
        // "nothing matches the query" is a lie when only the time window is empty.
        expect(web('src/components/Search/EventsSearchPanel.tsx')).toMatch(/Search\.notFoundInWindow/)
    })

    it('the pager can say where in the result the visitor is', () => {
        expect(web('src/components/common/Pager/Pager.tsx')).toMatch(/Search\.rangeLabel/)
    })
})

describe('every result list uses the shared engine', () => {
    it('the pages ask for the total amount, not just the page', () => {
        expect(web('src/components/Search/graphql/searchPageUsers.graphql')).toMatch(/usersByQueryWithTotal/)
        expect(web('src/components/Search/graphql/searchPageEvents.graphql')).toMatch(/eventsByQuery/)
        expect(web('src/components/Search/graphql/searchPageGames.graphql')).toMatch(/byQueryWithTotal/)
        expect(web('src/components/Search/graphql/searchGroups.graphql')).toMatch(/groupsByQuery/)
    })

    it('the people list offers the games of the person found', () => {
        const row = web('src/components/Search/SearchPersonRow.tsx')

        expect(row).toMatch(/gamesOfAuthor/)
        expect(web('src/hooks/useRoutes.ts')).toMatch(/autor=/)
        // TextLink is a *named* export: importing it as a default gives `undefined`
        // and the card blows up at render time, which only the build notices.
        expect(row).toMatch(/import \{ TextLink \} from '\.\.\/common\/TextLink\/TextLink'/)
    })

    it('the header field searches every kind, not games only', () => {
        const source = headerForm()

        expect(source).toMatch(/searchAll\.graphql/)
        expect(source).toMatch(/Search\.tabGames/)
        expect(source).toMatch(/Search\.tabUsers/)
        expect(source).toMatch(/Search\.tabEvents/)
        expect(source).toMatch(/Search\.tabGroups/)
    })

    it('the unified document asks for the counts of each kind', () => {
        const document = web('src/components/common/PageHeader/graphql/searchAll.graphql')

        expect(document).toMatch(/search\(query: \$query, limit: \$limit\)/)
        ;['totalGames', 'totalUsers', 'totalEvents', 'totalGroups', 'suggestion'].forEach((field) => {
            expect(document).toMatch(new RegExp(`\\b${field}\\b`))
        })
    })
})

describe('the calendar and the catalog can be typed into', () => {
    it('the calendar filter searches the name and the place', () => {
        expect(web('src/components/Calendar/CalendarPanel.tsx')).toMatch(/componentTestIds\.calendar\.query/)
        expect(web('src/components/Calendar/calendarUtils.ts')).toMatch(/matchTextQuery\(\[event\.name, event\.loc\]/)
    })

    it('the catalog filter has the text input its URL parameter always supported', () => {
        expect(web('src/components/Catalog/CatalogFilterPanel.tsx')).toMatch(/componentTestIds\.catalog\.query/)
    })

    it('the catalog filter understands an author', () => {
        expect(web('src/components/Catalog/catalogState.ts')).toMatch(/authorIds/)
        expect(web('src/components/Catalog/CatalogPanel.tsx')).toMatch(/Catalog\.active\.author/)
    })
})

describe('the resolver tree the app runs exposes the new queries', () => {
    const shippedResolvers = () => web('src/api/src/resolvers/index.ts')
    const shippedSchema = () => web('src/api/src/schema.graphql')

    it('registers the unified search and the paged people query', () => {
        expect(shippedResolvers()).toMatch(/search: searchResolver/)
        expect(shippedResolvers()).toMatch(/usersByQueryWithTotal: usersByQueryWithTotalResolver/)
        expect(shippedResolvers()).toMatch(/eventsByQuery: eventsByQueryResolver/)
    })

    it('declares them in the schema', () => {
        const schema = shippedSchema()

        expect(schema).toMatch(/search\(query: String!, limit: Int\): SearchResults!/)
        expect(schema).toMatch(/usersByQueryWithTotal\(query: String!, offset: Int, limit: Int\): UsersPaged!/)
        expect(schema).toMatch(/eventCalendar\([^)]*query: String\): EventsPaged!/)
        expect(schema).toMatch(/authorIds: \[ID!\]/)
        // The events list collapses identical rows and says how many it holds.
        expect(schema).toMatch(/duplicates: \[EventDuplicate!\]!/)
    })

    it('ships the engine itself, so the web copy cannot fall behind the api one', () => {
        const shippedEngine = web('src/api/src/resolvers/search.ts')

        expect(shippedEngine).toMatch(/export function foldSearchText/)
        expect(shippedEngine).toMatch(/export function suggestQuery/)
        expect(shippedEngine).toMatch(/export async function gamesSearchPage/)
        expect(shippedEngine).toMatch(/export function groupEventsByIdentity/)
    })
})
