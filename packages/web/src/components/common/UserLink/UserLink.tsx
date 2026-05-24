import React from 'react'
import Link from 'next/link'
import { useRoutes } from '../../../hooks/useRoutes'

interface Props {
    readonly userId: string
    readonly className?: string
}

/**
 * Create Next.JS link to user
 *
 * @param userId User to ling to
 * @param className Optional classname to add to the 'A' tag
 * @param children Link contents
 */

const UserLink: React.FC<Props> = ({ userId, className, children }) => {
    const routes = useRoutes()
    const route = routes.userProfile(userId)

    return (
        <Link href={route.as} legacyBehavior>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className={className}>{children}</a>
        </Link>
    )
}

export default UserLink
