import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import EventDetailPanel from '../../src/components/EventDetail/EventDetailPanel'

interface Props {}
interface InitialProps {}

const EventDetailPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return <EventDetailPanel eventId={router.query.id as string} />
}

EventDetailPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default EventDetailPage
