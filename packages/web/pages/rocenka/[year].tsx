import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import YearReviewPanel from '../../src/components/YearReview/YearReviewPanel'
import BigLoading from '../../src/components/common/BigLoading/BigLoading'

interface Props {}
interface InitialProps {
    namespacesRequired: string[]
}

/**
 * The year review (`/rocenka/2025`): the content yearbook of one calendar
 * year — the games the community talked about, quotes from the year's
 * reviews, the new catalog games and the year's articles. The year comes
 * from the URL; a missing or invalid year falls back to the current one.
 */
const YearReviewPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()
    const yearParam = Array.isArray(router.query.year) ? router.query.year[0] : router.query.year
    const parsed = Number.parseInt(yearParam ?? '', 10)
    const year = Number.isInteger(parsed) ? parsed : new Date().getFullYear()

    if (!router.isReady && !yearParam) {
        return <BigLoading />
    }

    return <YearReviewPanel year={year} />
}

YearReviewPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default YearReviewPage
