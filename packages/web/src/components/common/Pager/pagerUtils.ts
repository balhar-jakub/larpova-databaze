/**
 * Generate page offsets to show in paged
 *
 * @param currentOffset Currently active offset (to determine shown window when there is too many pages)
 * @param lastPageOffset Offset of the last page
 * @param pageSize Items on one page
 * @param maxPages Maximum pages to show (maximum page offsets to generate)
 */
export const generatePageOffsets = (
    currentOffset: number,
    lastPageOffset: number,
    pageSize: number,
    maxPages: number,
): number[] => {
    let start = 0
    let end = lastPageOffset
    const pages = lastPageOffset / pageSize

    if (pages > maxPages) {
        // We cannot show whole range of pages
        if (currentOffset < pageSize * Math.floor(maxPages / 2)) {
            // Show start
            start = 0
            end = start + (maxPages - 1) * pageSize
        } else if (currentOffset > lastPageOffset - pageSize * Math.ceil(maxPages / 2)) {
            // Show end
            start = lastPageOffset - (maxPages - 1) * pageSize
            end = lastPageOffset
        } else {
            // show Middle
            start = currentOffset - (Math.ceil(maxPages / 2) - 1) * pageSize
            end = currentOffset + Math.floor(maxPages / 2) * pageSize
        }
    }

    const res: number[] = []
    for (let pageOffset = start; pageOffset <= end; pageOffset += pageSize) {
        res.push(pageOffset)
    }
    return res
}
