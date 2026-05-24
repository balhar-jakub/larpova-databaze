import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

interface Props {
    readonly title: string
    readonly description: string
    readonly image?: string
    readonly isHomepage?: boolean
}

const getBaseUrl = () => {
    if (process.env.SELF_URL) {
        return process.env.SELF_URL
    }

    return `${window.location.protocol}//${window.location.hostname}${
        window.location.port ? `:${window.location.port}` : ''
    }`
}

/**
 * Open Graph meta tags
 *
 * @param title Title (also used as a page title)
 * @param description Description
 * @param image Image
 * @param isHomepage Whether this is homepage (affects og:type)
 */
const OpenGraphMeta = ({ title, description, image, isHomepage = false }: Props) => {
    const router = useRouter()
    const baseUrl = getBaseUrl()

    return (
        <Head>
            <title>{title}</title>
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            {image && <meta property="og:image" content={`${baseUrl}${image}`} />}
            <meta property="og:type" content={isHomepage ? 'website' : 'article'} />
            <meta property="og:url" content={`${baseUrl}${router.asPath}`} />
        </Head>
    )
}

export default OpenGraphMeta
