import React, { useState, useEffect } from 'react'
import { createUseStyles } from 'react-jss'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@apollo/client'
import { Button } from 'react-bootstrap'
import { SearchPageUsersQuery, SearchPageUsersQueryVariables } from '../../graphql/__generated__/typescript-operations'
import BigLoading from '../common/BigLoading/BigLoading'
import { darkTheme } from '../../theme/darkTheme'
import UserLink from '../common/UserLink/UserLink'
import { computeAge } from '../../utils/dateUtils'
import { ProfileImage } from '../common/ProfileImage/ProfileImage'

const searchUsersGql = require('./graphql/searchPageUsers.graphql')

interface Props {
    readonly query: string
}

const useStyles = createUseStyles({
    itemHolder: {
        margin: -5,
        display: 'flex',
        flexWrap: 'wrap',
    },
    item: {
        margin: 5,
        padding: '10px 15px 10px 10px',
        background: darkTheme.backgroundRealWhite,
        color: darkTheme.textOnLight,
        borderRadius: 10,
        display: 'flex',
    },
    moreButtonHolder: {
        margin: '10px 0',
        textAlign: 'center',
    },
})

const BATCH_SIZE = 10

const User = ({ query }: Props) => {
    const { t } = useTranslation('common')
    const [lastOffset, setLastOffset] = useState(0)
    const classes = useStyles()
    const { data, loading, fetchMore } = useQuery<SearchPageUsersQuery, SearchPageUsersQueryVariables>(searchUsersGql, {
        variables: {
            query,
            offset: 0,
            limit: BATCH_SIZE + 1,
        },
    })

    const loadMore = () => {
        fetchMore({
            variables: {
                query,
                offset: lastOffset + BATCH_SIZE + 1,
                limit: BATCH_SIZE,
            },
        })
        setLastOffset(last => last + BATCH_SIZE)
    }

    useEffect(() => {
        // Reset shown size when query changed
        setLastOffset(0)
    }, [query])

    if (!data?.usersByQuery) {
        return <BigLoading />
    }

    const users = data?.usersByQuery || []
    if (users.length === 0) {
        return <span>{t('Search.notFound')}</span>
    }

    const expectedLength = lastOffset + BATCH_SIZE
    const shownUsers = users.slice(0, expectedLength)

    return (
        <>
            <div className={classes.itemHolder}>
                {shownUsers.map(user => (
                    <div className={classes.item}>
                        <ProfileImage userId={user.id} imageId={user.image?.id} />
                        <div>
                            {user.nickname ? `${user.nickname} ` : ''}
                            <UserLink userId={user.id}>{user.name}</UserLink>
                            <br />
                            {user.city}
                            {user.city && user.birthDate ? ', ' : ''}
                            {user.birthDate && t('Search.userAge', { age: computeAge(user.birthDate) })}
                        </div>
                    </div>
                ))}
            </div>
            {users.length > expectedLength && (
                <div className={classes.moreButtonHolder}>
                    <Button variant="dark" onClick={loadMore} disabled={loading}>
                        {t('Search.moreUsers')}
                    </Button>
                </div>
            )}
        </>
    )
}

export default User
