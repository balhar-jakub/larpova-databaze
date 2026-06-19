import React from 'react'
import Head from 'next/head'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { getLabelIds } from 'src/utils/roleUtils'
import EventCalendarListPanel from 'src/components/EventCalendar/EventCalendarListPanel'

interface Props {}
interface InitialProps {}

const CalendarPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return (
        <>
            <Head><title>Kalendář akcí — Larpová databáze</title></Head>
            <EventCalendarListPanel
                initialRequiredLabelIds={getLabelIds(router.query.initialRequiredLabelIds)}
                initialOptionalLabelIds={getLabelIds(router.query.initialOptionalLabelIds)}
            />
        </>
    )
}

CalendarPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default CalendarPage
