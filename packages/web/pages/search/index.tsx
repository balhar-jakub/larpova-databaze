import React from 'react'
import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import SearchPanel from '../../src/components/Search/SearchPanel'

interface Props {}
interface InitialProps {}

const SearchPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return (
        <>
            <Head><title>Hledání — Larpová databáze</title></Head>
            <SearchPanel
                initialQuery={(router.query.q as string) || (router.query.initialQuery as string)}
                initialTab={router.query.t as string}
            />
        </>
    )
}

SearchPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default SearchPage
