import React from 'react'
import { useQuery } from '@apollo/client'
import { createUseStyles } from 'react-jss'
// import { useTranslation } from 'react-i18next'
import isInBrowser from 'is-in-browser'
import { LoadSelfRatedQuery, LoadSelfRatedQueryVariables } from '../../graphql/__generated__/typescript-operations'
import { darkTheme } from '../../theme/darkTheme'
import AdminTabs from './AdminTabs'
import { WidthFixer } from '../common/WidthFixer/WidthFixer'
import BigLoading from '../common/BigLoading/BigLoading'
import UserLink from '../common/UserLink/UserLink'
import { GameLink } from '../common/GameLink/GameLink'

const loadSelfRatedGql = require('./graphql/loadSelfRated.graphql')

const useStyles = createUseStyles({
    row: {
        backgroundColor: darkTheme.backgroundWhite,
        padding: '20px 0',
    },
    userRow: {
        backgroundColor: darkTheme.backgroundRealWhite,
        display: 'flex',
        alignItems: 'center',
        margin: '4px 0',
        padding: '4px 20px',
    },
    nick: {
        width: 200,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    email: {
        width: 200,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    name: {
        width: 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        margin: '0 10px',
    },
})

const AdminSelfRatedPanel = () => {
    const classes = useStyles()
    // const { t } = useTranslation('common')

    const { data, loading } = useQuery<LoadSelfRatedQuery, LoadSelfRatedQueryVariables>(loadSelfRatedGql, {
        skip: !isInBrowser,
    })

    const isLoading = loading || !isInBrowser
    const selfRated = data?.admin.selfRated || []

    return (
        <>
            <AdminTabs selectedTab="selfRated" />

            <div className={classes.row}>
                {isLoading && <BigLoading />}
                {!isLoading && (
                    <WidthFixer>
                        {selfRated.map(entry => (
                            <div key={`${entry.game.id}:${entry.user.id}`} className={classes.userRow}>
                                <div className={classes.email}>{entry.user.email}</div>
                                <div className={classes.nick}>{entry.user.nickname}</div>
                                <div className={classes.name}>
                                    <UserLink userId={entry.user.id}>{entry.user.name}</UserLink>
                                </div>
                                <div>
                                    <GameLink game={entry.game}>{entry.game.name}</GameLink>
                                </div>
                            </div>
                        ))}
                    </WidthFixer>
                )}
            </div>
        </>
    )
}

export default AdminSelfRatedPanel
