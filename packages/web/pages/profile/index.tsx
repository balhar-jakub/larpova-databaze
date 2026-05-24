import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import UserSettingsPanel from '../../src/components/Profile/UserSettingsPanel'
import CurrentUserProfileContainer from '../../src/components/Profile/CurrentUserProfileContainer'
import OtherUserProfileContainer from '../../src/components/Profile/OtherUserProfileContainer'
import ChangePasswordPanel from '../../src/components/Profile/ChangePasswordPanel'
import SignInRequiredWrapper from '../../src/components/common/SignInRequiredWrapper/SignInRequiredWrapper'

interface Props {}
interface InitialProps {}

const Profile: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    const id = router.query.id as string
    const idNum = parseInt(id, 10)

    return (
        <SignInRequiredWrapper requiredRole={idNum > 0 ? 'ANONYMOUS' : 'USER'}>
            {id === 'settings' && <UserSettingsPanel />}
            {id === 'current' && <CurrentUserProfileContainer />}
            {id === 'changePassword' && <ChangePasswordPanel />}
            {idNum > 0 && <OtherUserProfileContainer userId={id} />}
        </SignInRequiredWrapper>
    )
}

Profile.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default Profile
