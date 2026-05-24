import React from 'react'
import { NextPage } from 'next'
import { GameDetailPanel } from 'src/components/GameDetail/GameDetailPanel'
import { useRouter } from 'next/router'

interface Props {}
interface InitialProps {}

const GameDetailPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return <GameDetailPanel gameId={router.query.id as string} />
}

GameDetailPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default GameDetailPage
