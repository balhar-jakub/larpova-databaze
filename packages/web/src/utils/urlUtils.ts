export const isAbsoluteHttpUrl = (value?: string): boolean => {
    const normalized = value?.trim()
    if (!normalized || !/^https?:\/\//i.test(normalized)) {
        return false
    }

    try {
        const parsed = new URL(normalized)
        return Boolean(parsed.hostname) && (parsed.protocol === 'https:' || parsed.protocol === 'http:')
    } catch {
        return false
    }
}
