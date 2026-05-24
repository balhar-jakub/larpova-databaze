import React from 'react'
import { NextPage } from 'next'
import AdminMenuPanel from '../../src/components/Admin/AdminMenuPanel'
import SignInRequiredWrapper from '../../src/components/common/SignInRequiredWrapper/SignInRequiredWrapper'

interface Props {}
interface InitialProps {}

const AdminMenuPage: NextPage<Props, InitialProps> = () => {
    return (
        <SignInRequiredWrapper requiredRole="EDITOR">
            <AdminMenuPanel />
        </SignInRequiredWrapper>
    )
}

AdminMenuPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default AdminMenuPage
