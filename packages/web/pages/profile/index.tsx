import React from 'react'
import Head from 'next/head'
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
    // Fallback: extract ID from the path (e.g., /profile/1 → id=1) for direct URL navigation
    const pathId = !id ? (router.asPath.match(/\/profile\/(\d+)/) ?? [])[1] : undefined
    const resolvedId = id || pathId || ''
    const idNum = parseInt(resolvedId, 10)

    return (
        <>
            <Head><title>Profil — Larpová databáze</title></Head>
            <SignInRequiredWrapper requiredRole={idNum > 0 ? 'ANONYMOUS' : 'USER'}>
                {id === 'settings' && <UserSettingsPanel />}
                {id === 'current' && <CurrentUserProfileContainer />}
                {id === 'changePassword' && <ChangePasswordPanel />}
                {idNum > 0 && <OtherUserProfileContainer userId={resolvedId} />}
            </SignInRequiredWrapper>
        </>
    )
}

Profile.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default Profile
