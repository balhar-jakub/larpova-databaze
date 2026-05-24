import { useTranslation } from 'react-i18next'

/**
 * Renders StringOrTranslatable - either renders string directly or translates it.
 */
export const useRenderStringOrTranslatable = () => {
    const { t } = useTranslation()

    return { t: (value: StringOrTranslatable) => (typeof value === 'string' ? value : t(value.key)) }
}
