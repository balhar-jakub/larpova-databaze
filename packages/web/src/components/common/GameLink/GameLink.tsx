import React from 'react'

import { Game } from 'src/graphql/__generated__/typescript-operations'
import Link from 'next/link'
import { useRoutes } from '../../../hooks/useRoutes'

interface Props {
    readonly game: Pick<Game, 'id' | 'name'>
    readonly className?: string
}

export const GameLink: React.FC<Props> = ({ game, className, children }) => {
    const routes = useRoutes()
    const route = routes.gameDetail(game.id, game.name ?? '')

    return (
        <Link href={route.as} legacyBehavior>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className={className}>{children}</a>
        </Link>
    )
}
