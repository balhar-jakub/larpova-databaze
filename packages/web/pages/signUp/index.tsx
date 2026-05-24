import React from 'react'
import { NextPage } from 'next'
import SignUpPanel from '../../src/components/SignUp/SignUpPanel'

interface Props {}
interface InitialProps {}

const SignUpPage: NextPage<Props, InitialProps> = () => {
    return <SignUpPanel />
}

SignUpPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default SignUpPage
