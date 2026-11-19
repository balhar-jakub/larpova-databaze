import React from 'react'
import Head from 'next/head'
import { NextPage } from 'next'
import FamilyKidsPanel from '../../src/components/FamilyKids/FamilyKidsPanel'

interface Props {}
interface InitialProps {}

/**
 * Family & kids view: larps and events suitable for children — a filtered
 * catalog plus upcoming family events, with kids-scoped reviews highlighted.
 * Not a separate site: same cards, same data, family-first filters.
 */
const FamilyKidsPage: NextPage<Props, InitialProps> = () => {
    return (
        <>
            <Head><title>Larpová databáze — pro rodiny a děti</title></Head>
            <FamilyKidsPanel />
        </>
    )
}

FamilyKidsPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default FamilyKidsPage
