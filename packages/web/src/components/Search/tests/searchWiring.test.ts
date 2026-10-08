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
        expect(searchPanel()).toMatch(/searchPageQuery\(/)
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
        // The games go through the catalog, which carries the facets and the orders.
        expect(web('src/components/Search/graphql/searchPageGames.graphql')).toMatch(/catalog\(filter: \$filter, order: \$order/)
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
        // Both pages name a filter with one shared function.
        expect(web('src/components/Catalog/catalogState.ts')).toMatch(/Catalog\.active\.author/)
    })
})

describe('the games of the search page bring the catalog facets and rankings', () => {
    it('asks the catalog, which is where the facets and the orders live', () => {
        const document = web('src/components/Search/graphql/searchPageGames.graphql')

        expect(document).toMatch(/catalog\(filter: \$filter, order: \$order, offset: \$offset, limit: \$limit\)/)
        expect(document).toMatch(/facets \{/)
        expect(document).toMatch(/labels \{/)
        expect(document).toMatch(/durations \{/)
        expect(document).toMatch(/yearMin/)
    })

    it('leads with relevance, not with the catalog recommended order', () => {
        expect(web('src/components/Search/searchHelpers.ts')).toMatch(
            /SEARCH_GAMES_DEFAULT_ORDER = GameCatalogOrder\.Relevance/,
        )

        const engine = web('src/api/src/resolvers/gameCatalog.ts')

        expect(engine).toMatch(/order === 'Relevance'/)
        expect(engine).toMatch(/queryIds\.slice\(offset, offset \+ limit\)/)
        // Without a query there is nothing to be relevant to.
        expect(engine).toMatch(/pageGameIds\(ctx, where, 'Recommended', offset, limit, null\)/)
        expect(web('src/api/src/schema.graphql')).toMatch(/\n    Relevance\n/)
    })

    it('reuses the catalog filter panel instead of writing a second filter', () => {
        const panel = web('src/components/Search/GamesSearchPanel.tsx')

        expect(panel).toMatch(/<CatalogFilterPanel/)
        expect(panel).toMatch(/SEARCH_ORDER_OPTIONS/)
        expect(panel).toMatch(/catalogActiveFilterText\(filter, t\)/)
        expect(web('src/components/Catalog/CatalogFilterPanel.tsx')).toMatch(/orders \?\? DEFAULT_ORDER_OPTIONS/)
        // Both pages name a filter the same way.
        expect(web('src/components/Catalog/CatalogPanel.tsx')).toMatch(/catalogActiveFilterText\(filter, t\)/)
    })

    it('keeps the filters in the URL next to the query', () => {
        expect(searchPanel()).toMatch(/searchPageQuery\(/)
        expect(searchPanel()).toMatch(/searchGamesState\(router\.query\)/)
        expect(searchPanel()).toMatch(/componentTestIds\.search\.section\('games'\)|GamesSearchPanel/)
    })

    it('the game rows can still name the author they matched', () => {
        // The catalog path has to load them too, not just the search engine one.
        expect(web('src/api/src/resolvers/gameCatalog.ts')).toMatch(/csld_game_has_author: \{ include: \{ csld_csld_user: true \} \}/)
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
