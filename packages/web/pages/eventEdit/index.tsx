import React from 'react'
import { NextPage } from 'next'
import { useRouter } from 'next/router'
import EventEditPanel from 'src/components/EventEdit/EventEditPanel'
import SignInRequiredWrapper from 'src/components/common/SignInRequiredWrapper/SignInRequiredWrapper'

interface Props {}
interface InitialProps {}

const EventEditPage: NextPage<Props, InitialProps> = () => {
    const router = useRouter()

    return (
        <SignInRequiredWrapper>
            <EventEditPanel eventId={router.query.id as string} />
        </SignInRequiredWrapper>
    )
}

EventEditPage.getInitialProps = async () => ({ namespacesRequired: ['common'] })

export default EventEditPage
