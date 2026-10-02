import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import CalendarPanel from '../../src/components/Calendar/CalendarPanel'

interface Props {}
interface InitialProps {}

/**
 * Event calendar. The filters live in the query string, so a filtered calendar
 * (and the old `/kalendar?initialRequiredLabelIds=…` links) can be shared.
 */
const CalendarPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return <CalendarPanel initialQuery={router.query} />
}

CalendarPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default CalendarPage
