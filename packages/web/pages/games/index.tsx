import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { LadderType } from '../../src/graphql/__generated__/typescript-operations'
import LadderPanel from '../../src/components/Ladders/LadderPanel'
import { getLabelIds } from '../../src/utils/roleUtils'

interface Props {}
interface InitialProps {}

const resolveLadderType = (ladderType?: string | string[]): LadderType => {
    if (!ladderType || Array.isArray(ladderType)) {
        return LadderType.RecentAndMostPlayed
    }

    // Uppercase first letter, because in path they are lowercased
    const fixedLadderType = `${ladderType[0].toUpperCase()}${ladderType.substr(1)}`

    switch (fixedLadderType) {
        case LadderType.RecentAndMostPlayed:
            return LadderType.RecentAndMostPlayed
        case LadderType.Recent:
            return LadderType.Recent
        case LadderType.Best:
            return LadderType.Best
        case LadderType.MostPlayed:
            return LadderType.MostPlayed
        case LadderType.MostCommented:
            return LadderType.MostCommented
        default:
            return LadderType.RecentAndMostPlayed
    }
}

const GamesPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return (
        <LadderPanel
            ladderType={resolveLadderType(router.query.ladderType)}
            initialRequiredLabelIds={getLabelIds(router.query.initialRequiredLabelIds)}
            initialOptionalLabelIds={getLabelIds(router.query.initialOptionalLabelIds)}
        />
    )
}

GamesPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default GamesPage
