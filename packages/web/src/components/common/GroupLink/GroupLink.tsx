import React from 'react'
import Link from 'next/link'

interface Props {
    readonly groupId: string
    readonly className?: string
    readonly children?: React.ReactNode
}

/**
 * Create Next.JS link to group
 *
 * @param groupId Group to link to
 * @param className Optional classname to add to the 'A' tag
 * @param children Link contents
 */

const GroupLink: React.FC<Props> = ({ groupId, className, children }) => (
    <Link href={`/group/${groupId}`} legacyBehavior>
        <a className={className}>{children}</a>
    </Link>
)

export default GroupLink
