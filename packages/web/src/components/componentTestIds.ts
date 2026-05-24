/**
 * Test IDs for components
 */
export const componentTestIds = {
    gameRatingBox: {
        wrapper: 'gameRatingBox.wrapper',
    },
    carousel: {
        leftButton: 'carouselLeftButton',
        rightButton: 'carouselRightButton',
        items: 'carouselItems',
        item: (offset: number) => `carouselItem${offset}`,
    },
}
