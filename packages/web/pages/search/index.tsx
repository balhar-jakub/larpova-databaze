import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import SearchPanel from '../../src/components/Search/SearchPanel'

interface Props {}
interface InitialProps {}

const SearchPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return <SearchPanel initialQuery={router.query.initialQuery as string} />
}

SearchPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default SearchPage
