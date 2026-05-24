import React from 'react'
import Link from 'next/link'
import { Event } from 'src/graphql/__generated__/typescript-operations'
import { useRoutes } from '../../../hooks/useRoutes'

interface Props {
    readonly event: Pick<Event, 'id' | 'name'>
    readonly className?: string
}

/**
 * Create Next.JS link to event
 *
 * @param eventIdId Event to link to
 * @param className Optional classname to add to the 'A' tag
 * @param children Link contents
 */

const EventLink: React.FC<Props> = ({ event, className, children }) => {
    const routes = useRoutes()
    const route = routes.eventDetail(event.id, event.name ?? '')

    return (
        <Link href={route.as} legacyBehavior>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className={className}>{children}</a>
        </Link>
    )
}

export default EventLink
