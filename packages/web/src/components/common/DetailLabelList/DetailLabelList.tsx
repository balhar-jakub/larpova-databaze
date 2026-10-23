import React from 'react'
import { createUseStyles } from 'react-jss'
import Link from 'next/link'
import { Label } from '../../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../../theme/darkTheme'
import { useRoutes } from '../../../hooks/useRoutes'

interface Props {
    readonly labels: Array<Pick<Label, 'id' | 'name' | 'description' | 'isRequired'>>
    readonly linkType: 'games' | 'events'
}

const useStyles = createUseStyles({
    wrapper: {
        padding: '0 10px',
        display: 'flex',
        flexWrap: 'wrap',
    },
    label: {
        borderRadius: 3,
        padding: '3px 5px',
        margin: '0 5px 5px 0',
        backgroundColor: darkTheme.backgroundWhite,
        color: darkTheme.textOnLightDark,
        fontSize: '0.75rem',
        whiteSpace: 'nowrap',

        '&:hover': {
            backgroundColor: darkTheme.textGreen,
            color: darkTheme.backgroundWhite,
        },
    },
})

/**
 * Label list in game /event detail
 */
const DetailLabelList = ({ labels, linkType }: Props) => {
    const classes = useStyles()
    const routes = useRoutes()

    return (
        <div className={classes.wrapper}>
            {labels.map(label => {
                // The catalog link: the label's id encoded as the ?labels=
                // filter (required labels) or via any-label mode. The old
                // routes.games()/routes.calendar() label args no longer exist
                // on those routes — the query carries the filter now.
                const labelQuery = label.isRequired
                    ? `?labels=${label.id}`
                    : `?labels=${label.id}&mode=any`
                const route = linkType === 'games' ? routes.games() : routes.calendar()
                const href = linkType === 'games' ? `${route.href}${labelQuery}` : route.href
                return (
                    <Link href={href} legacyBehavior passHref key={label.id}>
                        <a href="/" className={classes.label} title={label.description ?? undefined}>
                            {label.name}
                        </a>
                    </Link>
                )
            })}
        </div>
    )
}

export default DetailLabelList
