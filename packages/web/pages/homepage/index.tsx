import React from 'react'
import { NextPage } from 'next'
import { HomePagePanel } from '../../src/components/HomePage/HomePagePanel'

interface Props {}
interface InitialProps {}

const HomePage: NextPage<Props, InitialProps> = () => <HomePagePanel />

HomePage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default HomePage
