import React from 'react'
import { NextPage } from 'next'
import SignInRequiredWrapper from '../../src/components/common/SignInRequiredWrapper/SignInRequiredWrapper'
import AdminUserPanel from '../../src/components/Admin/AdminUsersPanel'

interface Props {}
interface InitialProps {}

const AdminUsersPage: NextPage<Props, InitialProps> = () => {
    return (
        <SignInRequiredWrapper requiredRole="ADMIN">
            <AdminUserPanel />
        </SignInRequiredWrapper>
    )
}

AdminUsersPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default AdminUsersPage
