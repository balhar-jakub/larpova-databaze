import NextI18Next from 'next-i18next'

const NextI18NextInstance = new NextI18Next({
    defaultLanguage: 'cs',
    otherLanguages: ['en'],
    browserLanguageDetection: true,
    serverLanguageDetection: false,
})

export const { appWithTranslation, withTranslation, useTranslation } = NextI18NextInstance

export default NextI18NextInstance
