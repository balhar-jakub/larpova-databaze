import React from 'react'
import Head from 'next/head'
import { NextPage } from 'next'
import { HomePagePanel } from '../../src/components/HomePage/HomePagePanel'

interface Props {}
interface InitialProps {}

const HomePage: NextPage<Props, InitialProps> = () => (
    <>
        <Head><title>Česko-slovenská larpová databáze</title></Head>
        <HomePagePanel />
    </>
)

HomePage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default HomePage
