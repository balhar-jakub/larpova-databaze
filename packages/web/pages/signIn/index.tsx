import React from 'react'
import { NextPage } from 'next'
import SignInPanel from '../../src/components/SignIn/SignInPanel'

interface Props {}
interface InitialProps {}

const SignInPage: NextPage<Props, InitialProps> = () => {
    return <SignInPanel />
}

SignInPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default SignInPage
