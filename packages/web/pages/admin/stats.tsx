import React from 'react'
import { NextPage } from 'next'
import SignInRequiredWrapper from '../../src/components/common/SignInRequiredWrapper/SignInRequiredWrapper'
import AdminStatsPanel from '../../src/components/Admin/AdminStatsPanel'

interface Props {}
interface InitialProps {}

const AdminStatsPage: NextPage<Props, InitialProps> = () => {
    return (
        <SignInRequiredWrapper requiredRole="EDITOR">
            <AdminStatsPanel />
        </SignInRequiredWrapper>
    )
}

AdminStatsPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default AdminStatsPage
