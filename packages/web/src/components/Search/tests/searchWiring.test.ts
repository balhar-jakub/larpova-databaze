import fs from 'fs'
import path from 'path'

/**
 * The search is wired in five places at once and they have to agree: the header
 * field, the search page (tabs + the query in the URL), the events tab, the
 * calendar filter, the catalog filter — and the resolver *tree the app really
 * runs*, which is packages/web/src/api/src (packages/api/src is the copy the
 * tests use). A change that lands in one of them and not the others is exactly
 * how the header field ended up searching games only.
 */
const web = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8')

const searchPanel = () => web('src/components/Search/SearchPanel.tsx')
const headerForm = () => web('src/components/common/PageHeader/HeaderSearchForm.tsx')
const searchPage = () => web('pages/search/index.tsx')

describe('the search page offers people and events', () => {
    it('has a tab for every kind of result', () => {
        const source = searchPanel()

        expect(source).toMatch(/key: 'games'/)
        expect(source).toMatch(/key: 'users'/)
        expect(source).toMatch(/key: 'events'/)
        expect(source).toMatch(/<EventsSearchPanel/)
    })

    it('keeps the query and the tab in the URL', () => {
        expect(searchPage()).toMatch(/router\.query\.q/)
        expect(searchPage()).toMatch(/router\.query\.t/)
        expect(searchPanel()).toMatch(/q: nextQuery/)
    })

    it('says why a one letter query searches nothing', () => {
        expect(searchPanel()).toMatch(/componentTestIds\.search\.tooShort/)
    })

    it('offers the corrected query when nothing was found', () => {
        expect(searchPanel()).toMatch(/onUseSuggestion/)
        expect(web('src/components/Search/SearchSuggestion.tsx')).toMatch(/Search\.didYouMean/)
    })
})

describe('every result list uses the shared engine', () => {
    it('the pages ask for the total amount, not just the page', () => {
        expect(web('src/components/Search/graphql/searchPageUsers.graphql')).toMatch(/usersByQueryWithTotal/)
        expect(web('src/components/Search/graphql/searchPageEvents.graphql')).toMatch(/eventsByQuery/)
        expect(web('src/components/Search/graphql/searchPageGames.graphql')).toMatch(/byQueryWithTotal/)
    })

    it('the people list offers the games of the person found', () => {
        const panel = web('src/components/Search/UserSearchPanel.tsx')

        expect(panel).toMatch(/gamesOfAuthor/)
        expect(web('src/hooks/useRoutes.ts')).toMatch(/autor=/)
        // TextLink is a *named* export: importing it as a default gives `undefined`
        // and the card blows up at render time, which only the build notices.
        expect(panel).toMatch(/import \{ TextLink \} from '\.\.\/common\/TextLink\/TextLink'/)
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
    })

    it('ships the engine itself, so the web copy cannot fall behind the api one', () => {
        const shippedEngine = web('src/api/src/resolvers/search.ts')

        expect(shippedEngine).toMatch(/export function foldSearchText/)
        expect(shippedEngine).toMatch(/export function suggestQuery/)
        expect(shippedEngine).toMatch(/export async function gamesSearchPage/)
    })
})
