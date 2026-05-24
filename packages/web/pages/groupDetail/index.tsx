import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import GroupDetailPanel from '../../src/components/GroupDetail/GroupDetailPanel'

interface Props {}
interface InitialProps {}

const GroupDetailPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return <GroupDetailPanel groupId={router.query.id as string} />
}

GroupDetailPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default GroupDetailPage
