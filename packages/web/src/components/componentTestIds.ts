/**
 * Test IDs for components
 */
export const componentTestIds = {
    gameRatingBox: {
        wrapper: 'gameRatingBox.wrapper',
    },
    catalog: {
        panel: 'catalog.panel',
        card: (gameId: string) => `catalogCard.${gameId}`,
        loadMore: 'catalog.loadMore',
        resultCount: 'catalog.resultCount',
        empty: 'catalog.empty',
        reset: 'catalog.reset',
        activeFilters: 'catalog.activeFilters',
        query: 'catalog.query',
    },
    calendar: {
        panel: 'calendar.panel',
        summary: 'calendar.summary',
        filters: 'calendar.filters',
        query: 'calendar.query',
        viewSwitch: 'calendar.viewSwitch',
        view: (view: string) => `calendar.view.${view}`,
        resultCount: 'calendar.resultCount',
        reset: 'calendar.reset',
        empty: 'calendar.empty',
        loadMore: 'calendar.loadMore',
        addEvent: 'calendar.addEvent',
    },
    carousel: {
        leftButton: 'carouselLeftButton',
        rightButton: 'carouselRightButton',
        items: 'carouselItems',
        item: (offset: number) => `carouselItem${offset}`,
    },
    search: {
        panel: 'search.panel',
        tabs: 'search.tabs',
        resultCount: 'search.resultCount',
        empty: 'search.empty',
        tooShort: 'search.tooShort',
        suggestion: 'search.suggestion',
        userCard: (userId: string) => `search.userCard.${userId}`,
        eventList: 'search.eventList',
        headerResults: 'search.headerResults',
        headerGroup: (kind: string) => `search.headerGroup.${kind}`,
        headerShowAll: (kind: string) => `search.headerShowAll.${kind}`,
    },
}
