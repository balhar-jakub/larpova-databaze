import React from 'react'
import { NextPage } from 'next'
import AdminSelfRatedPanel from 'src/components/Admin/AdminSelfRatedPanel'
import SignInRequiredWrapper from '../../src/components/common/SignInRequiredWrapper/SignInRequiredWrapper'

interface Props {}
interface InitialProps {}

const AdminSelfRatedPage: NextPage<Props, InitialProps> = () => {
    return (
        <SignInRequiredWrapper requiredRole="EDITOR">
            <AdminSelfRatedPanel />
        </SignInRequiredWrapper>
    )
}

AdminSelfRatedPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default AdminSelfRatedPage
