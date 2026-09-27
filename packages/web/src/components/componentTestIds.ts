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
    carousel: {
        leftButton: 'carouselLeftButton',
        rightButton: 'carouselRightButton',
        items: 'carouselItems',
        item: (offset: number) => `carouselItem${offset}`,
    },
}
