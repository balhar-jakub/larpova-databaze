import React, { useEffect, useState } from 'react'
import UserProfilePanel, { UserProfileUser } from './UserProfilePanel'
import { PAGE_SIZE } from './UserPagedCommentsPanel'

const GQL = `
query LoadUserProfile($userId: ID!, $commentsLimit: Int!) {
  loggedInUser { id }
  userById(userId: $userId) {
    id amountOfPlayed amountOfCreated email name nickname birthDate city
    image { id }
    authoredGames { id name year averageRating amountOfRatings }
    playedGames { game { id name year averageRating amountOfRatings } rating }
    wantedGames { id name year averageRating amountOfRatings }
    commentsPaged(offset: 0, limit: $commentsLimit) {
      totalAmount
      comments {
        id comment commentAsText added isHidden amountOfUpvotes
        game { id name year averageRating amountOfRatings }
        user { id name }
      }
    }
  }
}`

interface Props { readonly userId: string }

const OtherUserProfileContainer = ({ userId }: Props) => {
    const [user, setUser] = useState<UserProfileUser | undefined>(undefined)

    useEffect(() => {
        let cancelled = false
        fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: GQL, variables: { userId, commentsLimit: PAGE_SIZE } }),
        })
            .then(r => r.json())
            .then(json => {
                if (!cancelled) setUser(json?.data?.userById ?? undefined)
            })
        return () => { cancelled = true }
    }, [userId])

    return <UserProfilePanel userId={userId} user={user} profileOnly={true} />
}

export default OtherUserProfileContainer
