import React from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'src/lib/i18n'
import { Article } from '../../graphql/__generated__/typescript-operations'
import { DetailListHeader } from '../common/DetailListHeader/DetailListHeader'
import { darkTheme } from '../../theme/darkTheme'

interface Props {
    readonly articles: Array<Pick<Article, 'id' | 'url' | 'title' | 'source' | 'publishedAt'>>
    readonly titleKey?: string
}

const useStyles = createUseStyles({
    wrapper: {
        padding: 15,
        marginBottom: 12,
    },
    article: {
        display: 'block',
        color: darkTheme.textOnLightDark,
        fontSize: '0.75rem',
        padding: '4px 6px 4px 16px',
        lineHeight: '150%',

        '&:hover': {
            color: darkTheme.textOnLight,
        },
    },
    source: {
        opacity: 0.5,
    },
})

const formatPublishedDate = (publishedAt?: string | null) => {
    if (!publishedAt) return ''
    const year = publishedAt.slice(0, 4)
    const month = publishedAt.slice(5, 7)
    const day = publishedAt.slice(8, 10)
    if (!year || !month || !day) return ''
    return `${day}. ${month}. ${year}`
}

export const ArticleListPanel = ({ articles, titleKey }: Props) => {
    const classes = useStyles()
    const { t } = useTranslation('common')

    return (
        <>
            {titleKey && <DetailListHeader>{t(titleKey)}</DetailListHeader>}
            <div className={classes.wrapper}>
                {articles.map(article => {
                    const date = formatPublishedDate(article.publishedAt)

                    return (
                        <a
                            className={classes.article}
                            key={article.id}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {article.title}
                            {date && <> ({date})</>}
                            <span className={classes.source}> · {article.source === 'LARPY_CZ' ? 'larpy.cz' : 'larp.cz'}</span>
                        </a>
                    )
                })}
            </div>
        </>
    )
}
