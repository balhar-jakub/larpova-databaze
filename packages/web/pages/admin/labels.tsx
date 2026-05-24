import React from 'react'
import { NextPage } from 'next'
import SignInRequiredWrapper from '../../src/components/common/SignInRequiredWrapper/SignInRequiredWrapper'
import AdminLabelsPanel from '../../src/components/Admin/AdminLabelsPanel'

interface Props {}
interface InitialProps {}

const AdminLabelsPage: NextPage<Props, InitialProps> = () => {
    return (
        <SignInRequiredWrapper requiredRole="EDITOR">
            <AdminLabelsPanel />
        </SignInRequiredWrapper>
    )
}

AdminLabelsPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default AdminLabelsPage
