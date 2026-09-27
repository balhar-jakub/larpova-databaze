import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import CatalogPanel from '../../src/components/Catalog/CatalogPanel'

interface Props {}
interface InitialProps {}

/**
 * Games catalog. The filters live in the query string, so old
 * `/games?ladderType=Best` links still open the right order.
 */
const GamesPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return <CatalogPanel initialQuery={router.query} />
}

GamesPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default GamesPage
