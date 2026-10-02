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
    },
    calendar: {
        panel: 'calendar.panel',
        summary: 'calendar.summary',
        filters: 'calendar.filters',
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
}
