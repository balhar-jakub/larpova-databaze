/**
 * Convert array to arrays of chunks of defined max size
 *
 * @param items Items to process
 * @param chunkSize How many items in one chunk
 */
export const toChunks = <T>(items: T[], chunkSize: number): T[][] => {
    const res: T[][] = []
    let currentChunk: T[] = []

    items.forEach(item => {
        if (currentChunk.length === chunkSize) {
            res.push(currentChunk)
            currentChunk = []
        }
        currentChunk.push(item)
    })

    if (currentChunk.length > 0) {
        res.push(currentChunk)
    }

    return res
}
