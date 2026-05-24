import React from 'react'
import Link from 'next/link'

interface Props {
    readonly groupId: string
    readonly className?: string
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
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a className={className}>{children}</a>
    </Link>
)

export default GroupLink
