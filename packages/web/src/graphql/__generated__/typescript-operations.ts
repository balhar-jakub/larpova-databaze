export type Maybe<T> = T | null
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> }
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> }
export type DeleteLabelMutationVariables = Exact<{
    labelId: Scalars['ID']
}>

export type DeleteLabelMutation = { __typename?: 'Mutation' } & {
    admin: { __typename?: 'AdminMutation' } & { deleteLabel?: Maybe<{ __typename?: 'Label' } & Pick<Label, 'id'>> }
}

export type DeleteUserMutationVariables = Exact<{
    userId: Scalars['ID']
}>

export type DeleteUserMutation = { __typename?: 'Mutation' } & {
    admin: { __typename?: 'AdminMutation' } & { deleteUser?: Maybe<{ __typename?: 'User' } & Pick<User, 'id'>> }
}

export type AdminLabelFieldsFragment = { __typename?: 'Label' } & Pick<
    Label,
    'id' | 'name' | 'description' | 'isAuthorized' | 'isRequired'
>

export type LoadAllLabelsQueryVariables = Exact<{ [key: string]: never }>

export type LoadAllLabelsQuery = { __typename?: 'Query' } & {
    admin: { __typename?: 'AdminQuery' } & { allLabels: Array<{ __typename?: 'Label' } & AdminLabelFieldsFragment> }
}

export type LoadAllUsersQueryVariables = Exact<{ [key: string]: never }>

export type LoadAllUsersQuery = { __typename?: 'Query' } & {
    admin: { __typename?: 'AdminQuery' } & { allUsers: Array<{ __typename?: 'User' } & AdminUserFieldsFragment> }
}

export type LoadSelfRatedQueryVariables = Exact<{ [key: string]: never }>

export type LoadSelfRatedQuery = { __typename?: 'Query' } & {
    admin: { __typename?: 'AdminQuery' } & {
        selfRated: Array<
            { __typename?: 'SelfRated' } & {
                game: { __typename?: 'Game' } & Pick<Game, 'id' | 'name'>
                user: { __typename?: 'User' } & Pick<User, 'id' | 'email' | 'name' | 'nickname'>
            }
        >
    }
}

export type LoadStatsQueryVariables = Exact<{ [key: string]: never }>

export type LoadStatsQuery = { __typename?: 'Query' } & {
    admin: { __typename?: 'AdminQuery' } & {
        stats: Array<
            { __typename?: 'StatFact' } & Pick<
                StatFact,
                'id' | 'year' | 'month' | 'averageRating' | 'numRatings' | 'numComments'
            >
        >
    }
}

export type SetLabelAuthorizedMutationVariables = Exact<{
    labelId: Scalars['ID']
    authorized: Scalars['Boolean']
}>

export type SetLabelAuthorizedMutation = { __typename?: 'Mutation' } & {
    admin: { __typename?: 'AdminMutation' } & {
        setLabelAuthorized: { __typename?: 'Label' } & AdminLabelFieldsFragment
    }
}

export type SetLabelRequiredMutationVariables = Exact<{
    labelId: Scalars['ID']
    required: Scalars['Boolean']
}>

export type SetLabelRequiredMutation = { __typename?: 'Mutation' } & {
    admin: { __typename?: 'AdminMutation' } & { setLabelRequired: { __typename?: 'Label' } & AdminLabelFieldsFragment }
}

export type UpdateLabelMutationVariables = Exact<{
    input: UpdateLabelInput
}>

export type UpdateLabelMutation = { __typename?: 'Mutation' } & {
    admin: { __typename?: 'AdminMutation' } & { updateLabel: { __typename?: 'Label' } & AdminLabelFieldsFragment }
}

export type UpdateUserRoleMutationVariables = Exact<{
    userId: Scalars['ID']
    role: UserRoleIn
}>

export type UpdateUserRoleMutation = { __typename?: 'Mutation' } & {
    admin: { __typename?: 'AdminMutation' } & { setUserRole: { __typename?: 'User' } & AdminUserFieldsFragment }
}

export type AdminUserFieldsFragment = { __typename?: 'User' } & Pick<User, 'id' | 'name' | 'nickname' | 'role'>

export type CalendarEventDataFragment = { __typename?: 'Event' } & Pick<
    Event,
    'id' | 'name' | 'from' | 'to' | 'web' | 'loc'
> & { labels?: Maybe<Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name'>>> }

export type LoadCalendarEventsQueryVariables = Exact<{
    from?: Maybe<Scalars['String']>
    to?: Maybe<Scalars['String']>
    offset: Scalars['Int']
    limit: Scalars['Int']
    requiredLabels?: Maybe<Array<Scalars['ID']> | Scalars['ID']>
    optionalLabels?: Maybe<Array<Scalars['ID']> | Scalars['ID']>
}>

export type LoadCalendarEventsQuery = { __typename?: 'Query' } & {
    eventCalendar: { __typename?: 'EventsPaged' } & Pick<EventsPaged, 'totalAmount'> & {
            events: Array<{ __typename?: 'Event' } & CalendarEventDataFragment>
        }
} & AuthorizedLabelsFragment

export type MoreCalendarEventsQueryVariables = Exact<{
    from?: Maybe<Scalars['String']>
    to?: Maybe<Scalars['String']>
    offset: Scalars['Int']
    limit: Scalars['Int']
    requiredLabels?: Maybe<Array<Scalars['ID']> | Scalars['ID']>
    optionalLabels?: Maybe<Array<Scalars['ID']> | Scalars['ID']>
}>

export type MoreCalendarEventsQuery = { __typename?: 'Query' } & {
    eventCalendar: { __typename?: 'EventsPaged' } & Pick<EventsPaged, 'totalAmount'> & {
            events: Array<{ __typename?: 'Event' } & CalendarEventDataFragment>
        }
}

export type DeleteEventMutationVariables = Exact<{
    eventId: Scalars['ID']
}>

export type DeleteEventMutation = { __typename?: 'Mutation' } & {
    event: { __typename?: 'EventMutation' } & { deleteEvent: { __typename?: 'Event' } & Pick<Event, 'id'> }
}

export type LoadEventQueryVariables = Exact<{
    eventId: Scalars['ID']
}>

export type LoadEventQuery = { __typename?: 'Query' } & {
    eventById?: Maybe<
        { __typename?: 'Event' } & Pick<
            Event,
            'id' | 'name' | 'amountOfPlayers' | 'web' | 'loc' | 'from' | 'to' | 'description' | 'allowedActions'
        > & {
                labels?: Maybe<
                    Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name' | 'description' | 'isRequired'>>
                >
                games?: Maybe<Array<{ __typename?: 'Game' } & BaseGameDataFragment>>
            }
    >
}

export type AutoCompleteGamesQueryVariables = Exact<{
    query: Scalars['String']
    offset: Scalars['Int']
    limit: Scalars['Int']
}>

export type AutoCompleteGamesQuery = { __typename?: 'Query' } & {
    games: { __typename?: 'GamesQuery' } & {
        byQuery: Array<{ __typename?: 'Game' } & Pick<Game, 'id' | 'name' | 'year'>>
    }
}

export type CreateEventMutationVariables = Exact<{
    input: CreateEventInput
}>

export type CreateEventMutation = { __typename?: 'Mutation' } & {
    event: { __typename?: 'EventMutation' } & { createEvent: { __typename?: 'Event' } & Pick<Event, 'id' | 'name'> }
}

export type LoadEventForEditQueryVariables = Exact<{
    eventId: Scalars['ID']
}>

export type LoadEventForEditQuery = { __typename?: 'Query' } & {
    eventById?: Maybe<
        { __typename?: 'Event' } & Pick<
            Event,
            'id' | 'name' | 'from' | 'to' | 'amountOfPlayers' | 'web' | 'loc' | 'description'
        > & {
                games?: Maybe<Array<{ __typename?: 'Game' } & Pick<Game, 'id' | 'name' | 'year'>>>
                labels?: Maybe<
                    Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name' | 'description' | 'isRequired'>>
                >
            }
    >
} & AuthorizedLabelsFragment

export type UpdateEventMutationVariables = Exact<{
    input: UpdateEventInput
}>

export type UpdateEventMutation = { __typename?: 'Mutation' } & {
    event: { __typename?: 'EventMutation' } & { updateEvent: { __typename?: 'Event' } & Pick<Event, 'id' | 'name'> }
}

export type CachedGameDataFragment = { __typename?: 'Game' } & Pick<
    Game,
    'id' | 'name' | 'averageRating' | 'amountOfRatings'
>

export type DeleteGameMutationVariables = Exact<{
    gameId: Scalars['ID']
}>

export type DeleteGameMutation = { __typename?: 'Mutation' } & {
    game: { __typename?: 'GameMutation' } & { deleteGame: { __typename?: 'Game' } & Pick<Game, 'id'> }
}

export type DeleteRatingMutationVariables = Exact<{
    gameId: Scalars['ID']
    userId: Scalars['ID']
}>

export type DeleteRatingMutation = { __typename?: 'Mutation' } & {
    game: { __typename?: 'GameMutation' } & { deleteGameRating: { __typename?: 'Game' } & GameRatingsUpdateFragment }
}

export type GameRatingsUpdateFragment = { __typename?: 'Game' } & Pick<
    Game,
    'id' | 'averageRating' | 'totalRating' | 'amountOfRatings' | 'amountOfPlayed'
> & {
        currentUsersRating?: Maybe<{ __typename?: 'Rating' } & Pick<Rating, 'id' | 'rating' | 'state'>>
        ratingStats: Array<{ __typename?: 'RatingCount' } & Pick<RatingCount, 'count' | 'rating'>>
        ratings: Array<
            { __typename?: 'Rating' } & Pick<Rating, 'id' | 'rating'> & {
                    user: { __typename?: 'User' } & Pick<User, 'id' | 'name'>
                }
        >
    }

export type GameDetailQueryVariables = Exact<{
    gameId: Scalars['ID']
}>

export type GameDetailQuery = { __typename?: 'Query' } & {
    gameById?: Maybe<
        { __typename?: 'Game' } & Pick<
            Game,
            | 'id'
            | 'name'
            | 'players'
            | 'menRole'
            | 'womenRole'
            | 'bothRole'
            | 'hours'
            | 'days'
            | 'year'
            | 'web'
            | 'galleryURL'
            | 'photoAuthor'
            | 'description'
            | 'averageRating'
            | 'amountOfRatings'
            | 'amountOfPlayed'
            | 'commentsDisabled'
            | 'ratingsDisabled'
            | 'allowedActions'
        > & {
                coverImage?: Maybe<{ __typename?: 'Image' } & Pick<Image, 'id'>>
                currentUsersRating?: Maybe<{ __typename?: 'Rating' } & Pick<Rating, 'id' | 'rating' | 'state'>>
                labels: Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name' | 'description' | 'isRequired'>>
                ratingStats: Array<{ __typename?: 'RatingCount' } & Pick<RatingCount, 'count' | 'rating'>>
                video?: Maybe<{ __typename?: 'Video' } & Pick<Video, 'id' | 'path'>>
                authors: Array<{ __typename?: 'User' } & Pick<User, 'id' | 'name' | 'nickname'>>
                groupAuthor: Array<{ __typename?: 'Group' } & Pick<Group, 'id' | 'name'>>
                similarGames: Array<
                    { __typename?: 'Game' } & Pick<Game, 'id' | 'name' | 'averageRating' | 'amountOfRatings' | 'year'>
                >
                gamesOfAuthors: Array<
                    { __typename?: 'Game' } & Pick<Game, 'id' | 'name' | 'averageRating' | 'amountOfRatings' | 'year'>
                >
                events: Array<{ __typename?: 'Event' } & Pick<Event, 'id' | 'name' | 'from' | 'to'>>
                ratings: Array<
                    { __typename?: 'Rating' } & Pick<Rating, 'id' | 'rating'> & {
                            user: { __typename?: 'User' } & Pick<User, 'id' | 'name'>
                        }
                >
            }
    >
}

export type MoreCommentsQueryVariables = Exact<{
    gameId: Scalars['ID']
    commentsOffset: Scalars['Int']
    commentsLimit: Scalars['Int']
}>

export type MoreCommentsQuery = { __typename?: 'Query' } & {
    gameById?: Maybe<
        { __typename?: 'Game' } & Pick<Game, 'id'> & {
                commentsPaged: { __typename?: 'CommentsPaged' } & Pick<CommentsPaged, 'totalAmount'> & {
                        comments: Array<{ __typename?: 'Comment' } & GameDetailCommentFragment>
                    }
                currentUsersComment?: Maybe<{ __typename?: 'Comment' } & Pick<Comment, 'id' | 'comment'>>
            }
    >
}

export type UpdateCommentMutationVariables = Exact<{
    gameId: Scalars['ID']
    comment: Scalars['String']
}>

export type UpdateCommentMutation = { __typename?: 'Mutation' } & {
    game: { __typename?: 'GameMutation' } & { createOrUpdateComment: { __typename?: 'Game' } & Pick<Game, 'id'> }
}

export type UpdateGameRatingMutationVariables = Exact<{
    gameId: Scalars['ID']
    rating: Scalars['Int']
}>

export type UpdateGameRatingMutation = { __typename?: 'Mutation' } & {
    game: { __typename?: 'GameMutation' } & { rateGame: { __typename?: 'Game' } & GameRatingsUpdateFragment }
}

export type UpdateGameStateMutationVariables = Exact<{
    gameId: Scalars['ID']
    state: Scalars['Int']
}>

export type UpdateGameStateMutation = { __typename?: 'Mutation' } & {
    game: { __typename?: 'GameMutation' } & { setGamePlayedState: { __typename?: 'Game' } & GameRatingsUpdateFragment }
}

export type CreateGameMutationVariables = Exact<{
    input: CreateGameInput
}>

export type CreateGameMutation = { __typename?: 'Mutation' } & {
    game: { __typename?: 'GameMutation' } & { createGame: { __typename?: 'Game' } & Pick<Game, 'id' | 'name'> }
}

export type LoadGameForEditQueryVariables = Exact<{
    gameId: Scalars['ID']
}>

export type LoadGameForEditQuery = { __typename?: 'Query' } & {
    gameById?: Maybe<
        { __typename?: 'Game' } & Pick<
            Game,
            | 'id'
            | 'name'
            | 'description'
            | 'year'
            | 'players'
            | 'womenRole'
            | 'menRole'
            | 'bothRole'
            | 'hours'
            | 'days'
            | 'web'
            | 'photoAuthor'
            | 'galleryURL'
            | 'ratingsDisabled'
            | 'commentsDisabled'
        > & {
                authors: Array<{ __typename?: 'User' } & Pick<User, 'id' | 'name' | 'nickname'>>
                groupAuthor: Array<{ __typename?: 'Group' } & Pick<Group, 'id' | 'name'>>
                video?: Maybe<{ __typename?: 'Video' } & Pick<Video, 'id' | 'path'>>
                labels: Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'isRequired'>>
            }
    >
} & AuthorizedLabelsFragment

export type SearchAuthorsQueryVariables = Exact<{
    query: Scalars['String']
    offset: Scalars['Int']
    limit: Scalars['Int']
}>

export type SearchAuthorsQuery = { __typename?: 'Query' } & {
    usersByQuery: Array<{ __typename?: 'User' } & Pick<User, 'id' | 'name' | 'nickname' | 'birthDate'>>
}

export type SearchGroupsQueryVariables = Exact<{
    query: Scalars['String']
    offset: Scalars['Int']
    limit: Scalars['Int']
}>

export type SearchGroupsQuery = { __typename?: 'Query' } & {
    groupsByQuery: Array<{ __typename?: 'Group' } & Pick<Group, 'id' | 'name'>>
}

export type UpdateGameMutationVariables = Exact<{
    input: UpdateGameInput
}>

export type UpdateGameMutation = { __typename?: 'Mutation' } & {
    game: { __typename?: 'GameMutation' } & { updateGame: { __typename?: 'Game' } & Pick<Game, 'id' | 'name'> }
}

export type CreateGroupMutationVariables = Exact<{
    input: CreateGroupInput
}>

export type CreateGroupMutation = { __typename?: 'Mutation' } & {
    group: { __typename?: 'GroupMutation' } & { createGroup: { __typename?: 'Group' } & Pick<Group, 'id'> }
}

export type LoadGroupQueryVariables = Exact<{
    groupId: Scalars['ID']
}>

export type LoadGroupQuery = { __typename?: 'Query' } & {
    groupById?: Maybe<
        { __typename?: 'Group' } & Pick<Group, 'id' | 'name'> & {
                authorsOf: Array<{ __typename?: 'Game' } & BaseGameDataFragment>
            }
    >
}

export type UpdateGroupMutationVariables = Exact<{
    input: UpdateGroupInput
}>

export type UpdateGroupMutation = { __typename?: 'Mutation' } & {
    group: { __typename?: 'GroupMutation' } & { updateGroup: { __typename?: 'Group' } & Pick<Group, 'id'> }
}

export type BaseCommentDataFragment = { __typename?: 'Comment' } & Pick<Comment, 'id' | 'commentAsText' | 'added'> & {
        game: { __typename?: 'Game' } & BaseGameDataFragment
        user: { __typename?: 'User' } & Pick<User, 'id' | 'name' | 'nickname'> & {
                image?: Maybe<{ __typename?: 'Image' } & Pick<Image, 'id' | 'path'>>
            }
    }

export type GetHomePageDataQueryVariables = Exact<{ [key: string]: never }>

export type GetHomePageDataQuery = { __typename?: 'Query' } & {
    homepage: { __typename?: 'HomepageQuery' } & {
        lastAddedGames: Array<{ __typename?: 'Game' } & BaseGameDataFragment>
        mostPopularGames: Array<{ __typename?: 'Game' } & BaseGameDataFragment>
        nextEvents: Array<
            { __typename?: 'Event' } & Pick<Event, 'id' | 'name' | 'from' | 'to' | 'loc' | 'amountOfPlayers'>
        >
        lastComments: Array<{ __typename?: 'Comment' } & BaseCommentDataFragment>
    }
}

export type GetMoreLastCommentsQueryVariables = Exact<{
    offset?: Maybe<Scalars['Int']>
    limit?: Maybe<Scalars['Int']>
}>

export type GetMoreLastCommentsQuery = { __typename?: 'Query' } & {
    homepage: { __typename?: 'HomepageQuery' } & {
        lastComments: Array<{ __typename?: 'Comment' } & BaseCommentDataFragment>
    }
}

export type LadderInitialGamesQueryVariables = Exact<{
    ladderType: LadderType
    offset: Scalars['Int']
    limit: Scalars['Int']
    requiredLabels?: Maybe<Array<Scalars['ID']> | Scalars['ID']>
    optionalLabels?: Maybe<Array<Scalars['ID']> | Scalars['ID']>
}>

export type LadderInitialGamesQuery = { __typename?: 'Query' } & {
    games: { __typename?: 'GamesQuery' } & {
        ladder: { __typename?: 'GamesPaged' } & Pick<GamesPaged, 'totalAmount'> & {
                games: Array<{ __typename?: 'Game' } & LadderGameDataFragment>
            }
    }
} & AuthorizedLabelsFragment

export type LadderMoreGamesQueryVariables = Exact<{
    ladderType: LadderType
    offset: Scalars['Int']
    limit: Scalars['Int']
    requiredLabels?: Maybe<Array<Scalars['ID']> | Scalars['ID']>
    optionalLabels?: Maybe<Array<Scalars['ID']> | Scalars['ID']>
}>

export type LadderMoreGamesQuery = { __typename?: 'Query' } & {
    games: { __typename?: 'GamesQuery' } & {
        ladder: { __typename?: 'GamesPaged' } & Pick<GamesPaged, 'totalAmount'> & {
                games: Array<{ __typename?: 'Game' } & LadderGameDataFragment>
            }
    }
}

export type ChangePasswordMutationVariables = Exact<{
    oldPassword: Scalars['String']
    newPassword: Scalars['String']
}>

export type ChangePasswordMutation = { __typename?: 'Mutation' } & {
    user: { __typename?: 'UserMutation' } & { updateLoggedInUserPassword: { __typename?: 'User' } & Pick<User, 'id'> }
}

export type UserProfileDataFragment = { __typename?: 'User' } & Pick<
    User,
    'id' | 'amountOfPlayed' | 'amountOfCreated' | 'email' | 'name' | 'nickname' | 'birthDate' | 'city'
> & {
        image?: Maybe<{ __typename?: 'Image' } & Pick<Image, 'id'>>
        authoredGames: Array<{ __typename?: 'Game' } & BaseGameDataFragment>
        playedGames: Array<
            { __typename?: 'GameWithRating' } & Pick<GameWithRating, 'rating'> & {
                    game: { __typename?: 'Game' } & Pick<Game, 'year'> & BaseGameDataFragment
                }
        >
        wantedGames: Array<{ __typename?: 'Game' } & Pick<Game, 'year'> & BaseGameDataFragment>
    }

export type LoadCurrentUserProfileQueryVariables = Exact<{
    commentsLimit: Scalars['Int']
}>

export type LoadCurrentUserProfileQuery = { __typename?: 'Query' } & {
    loggedInUser?: Maybe<
        { __typename?: 'User' } & {
            commentsPaged: { __typename?: 'CommentsPaged' } & Pick<CommentsPaged, 'totalAmount'> & {
                    comments: Array<
                        { __typename?: 'Comment' } & {
                            game: { __typename?: 'Game' } & BaseGameDataFragment
                        } & GameDetailCommentFragment
                    >
                }
        } & UserProfileDataFragment
    >
}

export type LoadCurrentUserSettingsQueryVariables = Exact<{ [key: string]: never }>

export type LoadCurrentUserSettingsQuery = { __typename?: 'Query' } & {
    loggedInUser?: Maybe<
        { __typename?: 'User' } & Pick<
            User,
            'id' | 'amountOfPlayed' | 'amountOfCreated' | 'email' | 'name' | 'nickname' | 'birthDate' | 'city'
        > & { image?: Maybe<{ __typename?: 'Image' } & Pick<Image, 'id'>> }
    >
}

export type LoadUserProfileQueryVariables = Exact<{
    userId: Scalars['ID']
    commentsLimit: Scalars['Int']
}>

export type LoadUserProfileQuery = { __typename?: 'Query' } & {
    loggedInUser?: Maybe<{ __typename?: 'User' } & Pick<User, 'id'>>
    userById?: Maybe<
        { __typename?: 'User' } & {
            commentsPaged: { __typename?: 'CommentsPaged' } & Pick<CommentsPaged, 'totalAmount'> & {
                    comments: Array<
                        { __typename?: 'Comment' } & {
                            game: { __typename?: 'Game' } & BaseGameDataFragment
                        } & GameDetailCommentFragment
                    >
                }
        } & UserProfileDataFragment
    >
}

export type MoreUserCommentsQueryVariables = Exact<{
    userId: Scalars['ID']
    offset: Scalars['Int']
    limit: Scalars['Int']
}>

export type MoreUserCommentsQuery = { __typename?: 'Query' } & {
    userById?: Maybe<
        { __typename?: 'User' } & {
            commentsPaged: { __typename?: 'CommentsPaged' } & Pick<CommentsPaged, 'totalAmount'> & {
                    comments: Array<
                        { __typename?: 'Comment' } & {
                            game: { __typename?: 'Game' } & BaseGameDataFragment
                        } & GameDetailCommentFragment
                    >
                }
        }
    >
}

export type UpdateUserSettingsMutationVariables = Exact<{
    input: UpdateLoggedInUserInput
}>

export type UpdateUserSettingsMutation = { __typename?: 'Mutation' } & {
    user: { __typename?: 'UserMutation' } & { updateLoggedInUser: { __typename?: 'User' } & Pick<User, 'id'> }
}

export type FinishRecoverPasswordMutationVariables = Exact<{
    newPassword: Scalars['String']
    token: Scalars['String']
}>

export type FinishRecoverPasswordMutation = { __typename?: 'Mutation' } & {
    user: { __typename?: 'UserMutation' } & {
        finishRecoverPassword?: Maybe<{ __typename?: 'User' } & Pick<User, 'id'>>
    }
}

export type StartRecoverPasswordMutationVariables = Exact<{
    email: Scalars['String']
    recoverUrl: Scalars['String']
}>

export type StartRecoverPasswordMutation = { __typename?: 'Mutation' } & {
    user: { __typename?: 'UserMutation' } & Pick<UserMutation, 'startRecoverPassword'>
}

export type SearchPageGamesQueryVariables = Exact<{
    query: Scalars['String']
    limit: Scalars['Int']
    offset: Scalars['Int']
}>

export type SearchPageGamesQuery = { __typename?: 'Query' } & {
    games: { __typename?: 'GamesQuery' } & {
        byQueryWithTotal: { __typename?: 'GamesPaged' } & Pick<GamesPaged, 'totalAmount'> & {
                games: Array<{ __typename?: 'Game' } & LadderGameDataFragment>
            }
    }
}

export type SearchPageUsersQueryVariables = Exact<{
    query: Scalars['String']
    offset: Scalars['Int']
    limit: Scalars['Int']
}>

export type SearchPageUsersQuery = { __typename?: 'Query' } & {
    usersByQuery: Array<
        { __typename?: 'User' } & Pick<User, 'id' | 'name' | 'nickname' | 'birthDate' | 'city'> & {
                image?: Maybe<{ __typename?: 'Image' } & Pick<Image, 'id'>>
            }
    >
}

export type LogInMutationVariables = Exact<{
    userName: Scalars['String']
    password: Scalars['String']
}>

export type LogInMutation = { __typename?: 'Mutation' } & {
    user: { __typename?: 'UserMutation' } & { logIn?: Maybe<{ __typename?: 'User' } & Pick<User, 'id'>> }
}

export type CreateUserMutationVariables = Exact<{
    input: CreateUserInput
}>

export type CreateUserMutation = { __typename?: 'Mutation' } & {
    user: { __typename?: 'UserMutation' } & { createUser?: Maybe<{ __typename?: 'User' } & Pick<User, 'id'>> }
}

export type GetConfigQueryVariables = Exact<{ [key: string]: never }>

export type GetConfigQuery = { __typename?: 'Query' } & {
    config: { __typename?: 'Config' } & Pick<Config, 'reCaptchaKey'>
}

export type SearchGamesQueryVariables = Exact<{
    query: Scalars['String']
    limit: Scalars['Int']
}>

export type SearchGamesQuery = { __typename?: 'Query' } & {
    games: { __typename?: 'GamesQuery' } & { byQuery: Array<{ __typename?: 'Game' } & BaseGameDataFragment> }
}

export type SignOutMutationVariables = Exact<{ [key: string]: never }>

export type SignOutMutation = { __typename?: 'Mutation' } & {
    user: { __typename?: 'UserMutation' } & { logOut?: Maybe<{ __typename?: 'User' } & Pick<User, 'id'>> }
}

export type SetCommentVisibleMutationVariables = Exact<{
    commentId: Scalars['ID']
    visible: Scalars['Boolean']
}>

export type SetCommentVisibleMutation = { __typename?: 'Mutation' } & {
    game: { __typename?: 'GameMutation' } & { setCommentVisible: { __typename?: 'Game' } & Pick<Game, 'id'> }
}

export type LoggedInUserQueryVariables = Exact<{ [key: string]: never }>

export type LoggedInUserQuery = { __typename?: 'Query' } & {
    loggedInUser?: Maybe<
        { __typename?: 'User' } & Pick<User, 'id' | 'role' | 'name' | 'nickname'> & {
                image?: Maybe<{ __typename?: 'Image' } & Pick<Image, 'id'>>
            }
    >
}

export type AuthorizedLabelsFragment = { __typename?: 'Query' } & {
    authorizedRequiredLabels: Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name' | 'description'>>
    authorizedOptionalLabels: Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name' | 'description'>>
}

export type BaseGameDataFragment = { __typename?: 'Game' } & Pick<
    Game,
    'id' | 'name' | 'players' | 'averageRating' | 'amountOfComments' | 'amountOfRatings'
>

export type GameDetailCommentFragment = { __typename?: 'Comment' } & Pick<
    Comment,
    'id' | 'added' | 'amountOfUpvotes' | 'comment' | 'isHidden'
> & {
        user: { __typename?: 'User' } & Pick<User, 'id' | 'name' | 'nickname'> & {
                image?: Maybe<{ __typename?: 'Image' } & Pick<Image, 'id'>>
            }
    }

export type LadderGameDataFragment = { __typename?: 'Game' } & Pick<
    Game,
    'id' | 'name' | 'year' | 'amountOfComments' | 'amountOfRatings' | 'averageRating' | 'totalRating'
> & { labels: Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name'>> }

export type CheckEmailQueryVariables = Exact<{
    email: Scalars['String']
}>

export type CheckEmailQuery = { __typename?: 'Query' } & {
    userByEmail?: Maybe<{ __typename?: 'User' } & Pick<User, 'id' | 'email' | 'name' | 'nickname'>>
}

export type LoadLabelsQueryVariables = Exact<{ [key: string]: never }>

export type LoadLabelsQuery = { __typename?: 'Query' } & {
    authorizedRequiredLabels: Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name' | 'description'>>
    authorizedOptionalLabels: Array<{ __typename?: 'Label' } & Pick<Label, 'id' | 'name' | 'description'>>
}

/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: string
    String: string
    Boolean: boolean
    Int: number
    Float: number
}

export type Query = {
    __typename?: 'Query'
    homepage: HomepageQuery
    loggedInUser?: Maybe<User>
    gameById?: Maybe<Game>
    groupById?: Maybe<Group>
    groupsByQuery: Array<Group>
    eventById?: Maybe<Event>
    eventCalendar: EventsPaged
    userById?: Maybe<User>
    userByEmail?: Maybe<User>
    usersByQuery: Array<User>
    games: GamesQuery
    authorizedRequiredLabels: Array<Label>
    authorizedOptionalLabels: Array<Label>
    admin: AdminQuery
    donations: Array<Donation>
    config: Config
}

export type QueryGameByIdArgs = {
    gameId: Scalars['ID']
}

export type QueryGroupByIdArgs = {
    groupId: Scalars['ID']
}

export type QueryGroupsByQueryArgs = {
    query: Scalars['String']
    offset?: Maybe<Scalars['Int']>
    limit?: Maybe<Scalars['Int']>
}

export type QueryEventByIdArgs = {
    eventId: Scalars['ID']
}

export type QueryEventCalendarArgs = {
    offset?: Maybe<Scalars['Int']>
    limit?: Maybe<Scalars['Int']>
    from?: Maybe<Scalars['String']>
    to?: Maybe<Scalars['String']>
    requiredLabels?: Maybe<Array<Scalars['ID']>>
    otherLabels?: Maybe<Array<Scalars['ID']>>
}

export type QueryUserByIdArgs = {
    userId: Scalars['ID']
}

export type QueryUserByEmailArgs = {
    email: Scalars['String']
}

export type QueryUsersByQueryArgs = {
    query: Scalars['String']
    offset?: Maybe<Scalars['Int']>
    limit?: Maybe<Scalars['Int']>
}

export type Mutation = {
    __typename?: 'Mutation'
    user: UserMutation
    game: GameMutation
    group: GroupMutation
    event: EventMutation
    admin: AdminMutation
}

export type HomepageQuery = {
    __typename?: 'HomepageQuery'
    lastAddedGames: Array<Game>
    mostPopularGames: Array<Game>
    lastComments: Array<Comment>
    nextEvents: Array<Event>
}

export type HomepageQueryLastCommentsArgs = {
    offset?: Maybe<Scalars['Int']>
    limit?: Maybe<Scalars['Int']>
}

export type GamesQuery = {
    __typename?: 'GamesQuery'
    byQuery: Array<Game>
    byQueryWithTotal: GamesPaged
    ladder: GamesPaged
}

export type GamesQueryByQueryArgs = {
    query: Scalars['String']
    offset?: Maybe<Scalars['Int']>
    limit?: Maybe<Scalars['Int']>
}

export type GamesQueryByQueryWithTotalArgs = {
    query: Scalars['String']
    offset?: Maybe<Scalars['Int']>
    limit?: Maybe<Scalars['Int']>
}

export type GamesQueryLadderArgs = {
    ladderType: LadderType
    offset?: Maybe<Scalars['Int']>
    limit?: Maybe<Scalars['Int']>
    requiredLabels?: Maybe<Array<Scalars['ID']>>
    otherLabels?: Maybe<Array<Scalars['ID']>>
}

export enum LadderType {
    RecentAndMostPlayed = 'RecentAndMostPlayed',
    MostPlayed = 'MostPlayed',
    Recent = 'Recent',
    Best = 'Best',
    MostCommented = 'MostCommented',
}

export type Game = {
    __typename?: 'Game'
    id: Scalars['ID']
    name?: Maybe<Scalars['String']>
    description?: Maybe<Scalars['String']>
    year?: Maybe<Scalars['Int']>
    web?: Maybe<Scalars['String']>
    hours?: Maybe<Scalars['Int']>
    days?: Maybe<Scalars['Int']>
    players?: Maybe<Scalars['Int']>
    menRole?: Maybe<Scalars['Int']>
    womenRole?: Maybe<Scalars['Int']>
    bothRole?: Maybe<Scalars['Int']>
    totalRating: Scalars['Float']
    averageRating: Scalars['Float']
    added: Scalars['String']
    amountOfComments: Scalars['Int']
    amountOfPlayed: Scalars['Int']
    amountOfRatings: Scalars['Int']
    galleryURL?: Maybe<Scalars['String']>
    photoAuthor?: Maybe<Scalars['String']>
    deleted?: Maybe<Scalars['Boolean']>
    ratingsDisabled?: Maybe<Scalars['Boolean']>
    commentsDisabled?: Maybe<Scalars['Boolean']>
    labels: Array<Label>
    currentUsersComment?: Maybe<Comment>
    currentUsersRating?: Maybe<Rating>
    comments: Array<Comment>
    commentsPaged: CommentsPaged
    authors: Array<User>
    groupAuthor: Array<Group>
    ratings: Array<Rating>
    ratingStats: Array<RatingCount>
    wantsToPlay: Array<User>
    similarGames: Array<Game>
    gamesOfAuthors: Array<Game>
    events: Array<Event>
    video?: Maybe<Video>
    coverImage?: Maybe<Image>
    photos: Array<Photo>
    allowedActions?: Maybe<Array<AllowedAction>>
}

export type GameCommentsPagedArgs = {
    offset: Scalars['Int']
    limit: Scalars['Int']
}

export type CommentsPaged = {
    __typename?: 'CommentsPaged'
    comments: Array<Comment>
    totalAmount: Scalars['Int']
}

export type GamesPaged = {
    __typename?: 'GamesPaged'
    games: Array<Game>
    totalAmount: Scalars['Int']
}

export type Event = {
    __typename?: 'Event'
    id: Scalars['ID']
    name?: Maybe<Scalars['String']>
    description?: Maybe<Scalars['String']>
    loc?: Maybe<Scalars['String']>
    web?: Maybe<Scalars['String']>
    deleted?: Maybe<Scalars['Boolean']>
    amountOfPlayers?: Maybe<Scalars['Int']>
    from?: Maybe<Scalars['String']>
    to?: Maybe<Scalars['String']>
    location?: Maybe<EventLocation>
    labels?: Maybe<Array<Label>>
    games?: Maybe<Array<Game>>
    allowedActions?: Maybe<Array<AllowedAction>>
}

export type EventLocation = {
    __typename?: 'EventLocation'
    lattitude: Scalars['Float']
    longtitude: Scalars['Float']
}

export type Label = {
    __typename?: 'Label'
    id: Scalars['ID']
    name?: Maybe<Scalars['String']>
    description?: Maybe<Scalars['String']>
    isRequired?: Maybe<Scalars['Boolean']>
    isAuthorized?: Maybe<Scalars['Boolean']>
}

export type Image = {
    __typename?: 'Image'
    id: Scalars['ID']
    path?: Maybe<Scalars['String']>
    contentType?: Maybe<Scalars['String']>
}

export type User = {
    __typename?: 'User'
    id: Scalars['ID']
    lastRating?: Maybe<Scalars['Int']>
    role?: Maybe<UserRole>
    amountOfComments?: Maybe<Scalars['Int']>
    amountOfPlayed?: Maybe<Scalars['Int']>
    amountOfCreated?: Maybe<Scalars['Int']>
    image?: Maybe<Image>
    commentsPaged: CommentsPaged
    ratings: Array<Rating>
    playedGames: Array<GameWithRating>
    wantedGames: Array<Game>
    authoredGames: Array<Game>
    name: Scalars['String']
    description?: Maybe<Scalars['String']>
    email: Scalars['String']
    nickname?: Maybe<Scalars['String']>
    birthDate?: Maybe<Scalars['String']>
    city?: Maybe<Scalars['String']>
}

export type UserCommentsPagedArgs = {
    offset: Scalars['Int']
    limit: Scalars['Int']
}

export type GameWithRating = {
    __typename?: 'GameWithRating'
    game: Game
    rating?: Maybe<Scalars['Int']>
}

export type Comment = {
    __typename?: 'Comment'
    id: Scalars['ID']
    comment?: Maybe<Scalars['String']>
    commentAsText?: Maybe<Scalars['String']>
    added?: Maybe<Scalars['String']>
    isHidden?: Maybe<Scalars['Boolean']>
    amountOfUpvotes: Scalars['Int']
    game: Game
    user: User
}

export type Group = {
    __typename?: 'Group'
    id: Scalars['ID']
    name?: Maybe<Scalars['String']>
    authorsOf: Array<Game>
}

export type Rating = {
    __typename?: 'Rating'
    id: Scalars['ID']
    rating?: Maybe<Scalars['Int']>
    state?: Maybe<Scalars['Int']>
    game: Game
    user: User
}

export type RatingCount = {
    __typename?: 'RatingCount'
    rating: Scalars['Int']
    count: Scalars['Int']
}

export type Video = {
    __typename?: 'Video'
    id: Scalars['ID']
    path?: Maybe<Scalars['String']>
}

export type Photo = {
    __typename?: 'Photo'
    id: Scalars['ID']
    orderSeq?: Maybe<Scalars['Int']>
    description?: Maybe<Scalars['String']>
    fullWidth: Scalars['Int']
    fullHeight: Scalars['Int']
    featured: Scalars['Boolean']
    game: Game
    image: Image
}

export type UserMutation = {
    __typename?: 'UserMutation'
    logIn?: Maybe<User>
    logOut?: Maybe<User>
    createUser?: Maybe<User>
    updateLoggedInUser: User
    updateLoggedInUserPassword: User
    startRecoverPassword?: Maybe<Scalars['Boolean']>
    finishRecoverPassword?: Maybe<User>
}

export type UserMutationLogInArgs = {
    userName: Scalars['String']
    password: Scalars['String']
}

export type UserMutationCreateUserArgs = {
    input: CreateUserInput
}

export type UserMutationUpdateLoggedInUserArgs = {
    input: UpdateLoggedInUserInput
}

export type UserMutationUpdateLoggedInUserPasswordArgs = {
    oldPassword: Scalars['String']
    newPassword: Scalars['String']
}

export type UserMutationStartRecoverPasswordArgs = {
    email: Scalars['String']
    recoverUrl: Scalars['String']
}

export type UserMutationFinishRecoverPasswordArgs = {
    token: Scalars['String']
    newPassword: Scalars['String']
}

export type CreateUserInput = {
    email: Scalars['String']
    password: Scalars['String']
    profilePicture?: Maybe<UploadedFileInput>
    name: Scalars['String']
    nickname?: Maybe<Scalars['String']>
    birthDate?: Maybe<Scalars['String']>
    city?: Maybe<Scalars['String']>
    recaptcha: Scalars['String']
}

export type UpdateLoggedInUserInput = {
    email: Scalars['String']
    profilePicture?: Maybe<UploadedFileInput>
    name: Scalars['String']
    nickname?: Maybe<Scalars['String']>
    birthDate?: Maybe<Scalars['String']>
    city?: Maybe<Scalars['String']>
}

export type GameMutation = {
    __typename?: 'GameMutation'
    createGame: Game
    updateGame: Game
    deleteGame: Game
    rateGame: Game
    deleteGameRating: Game
    setGamePlayedState: Game
    createOrUpdateComment: Game
    setCommentVisible: Game
    setCommentLiked: Game
}

export type GameMutationCreateGameArgs = {
    input: CreateGameInput
}

export type GameMutationUpdateGameArgs = {
    input: UpdateGameInput
}

export type GameMutationDeleteGameArgs = {
    gameId: Scalars['ID']
}

export type GameMutationRateGameArgs = {
    gameId: Scalars['ID']
    rating?: Maybe<Scalars['Int']>
}

export type GameMutationDeleteGameRatingArgs = {
    gameId: Scalars['ID']
    userId?: Maybe<Scalars['ID']>
}

export type GameMutationSetGamePlayedStateArgs = {
    gameId: Scalars['ID']
    state: Scalars['Int']
}

export type GameMutationCreateOrUpdateCommentArgs = {
    gameId: Scalars['ID']
    comment: Scalars['String']
}

export type GameMutationSetCommentVisibleArgs = {
    commentId: Scalars['ID']
    visible: Scalars['Boolean']
}

export type GameMutationSetCommentLikedArgs = {
    commentId: Scalars['ID']
    liked: Scalars['Boolean']
}

export type GroupMutation = {
    __typename?: 'GroupMutation'
    createGroup: Group
    updateGroup: Group
}

export type GroupMutationCreateGroupArgs = {
    input?: Maybe<CreateGroupInput>
}

export type GroupMutationUpdateGroupArgs = {
    input?: Maybe<UpdateGroupInput>
}

export type CreateGameInput = {
    name: Scalars['String']
    description: Scalars['String']
    authors: Array<Scalars['ID']>
    newAuthors: Array<NewAuthorInput>
    groupAuthors: Array<Scalars['ID']>
    newGroupAuthors: Array<NewGroupAuthorInput>
    labels: Array<Scalars['ID']>
    newLabels: Array<NewLabelInput>
    year?: Maybe<Scalars['Int']>
    players?: Maybe<Scalars['Int']>
    menRole?: Maybe<Scalars['Int']>
    womenRole?: Maybe<Scalars['Int']>
    bothRole?: Maybe<Scalars['Int']>
    hours?: Maybe<Scalars['Int']>
    days?: Maybe<Scalars['Int']>
    coverImage?: Maybe<UploadedFileInput>
    web?: Maybe<Scalars['String']>
    photoAuthor?: Maybe<Scalars['String']>
    galleryURL?: Maybe<Scalars['String']>
    video?: Maybe<Scalars['String']>
    ratingsDisabled?: Maybe<Scalars['Boolean']>
    commentsDisabled?: Maybe<Scalars['Boolean']>
}

export type UpdateGameInput = {
    id: Scalars['ID']
    name: Scalars['String']
    description: Scalars['String']
    authors: Array<Scalars['ID']>
    newAuthors: Array<NewAuthorInput>
    groupAuthors: Array<Scalars['ID']>
    newGroupAuthors: Array<NewGroupAuthorInput>
    labels: Array<Scalars['ID']>
    newLabels: Array<NewLabelInput>
    year?: Maybe<Scalars['Int']>
    players?: Maybe<Scalars['Int']>
    menRole?: Maybe<Scalars['Int']>
    womenRole?: Maybe<Scalars['Int']>
    bothRole?: Maybe<Scalars['Int']>
    hours?: Maybe<Scalars['Int']>
    days?: Maybe<Scalars['Int']>
    coverImage?: Maybe<UploadedFileInput>
    web?: Maybe<Scalars['String']>
    photoAuthor?: Maybe<Scalars['String']>
    galleryURL?: Maybe<Scalars['String']>
    video?: Maybe<Scalars['String']>
    ratingsDisabled?: Maybe<Scalars['Boolean']>
    commentsDisabled?: Maybe<Scalars['Boolean']>
}

export type UploadedFileInput = {
    fileName: Scalars['String']
    contents: Scalars['String']
}

export type NewAuthorInput = {
    email?: Maybe<Scalars['String']>
    name: Scalars['String']
    nickname?: Maybe<Scalars['String']>
}

export type NewGroupAuthorInput = {
    name: Scalars['String']
}

export type NewLabelInput = {
    name: Scalars['String']
    description?: Maybe<Scalars['String']>
}

export type EventMutation = {
    __typename?: 'EventMutation'
    createEvent: Event
    updateEvent: Event
    deleteEvent: Event
}

export type EventMutationCreateEventArgs = {
    input: CreateEventInput
}

export type EventMutationUpdateEventArgs = {
    input: UpdateEventInput
}

export type EventMutationDeleteEventArgs = {
    eventId: Scalars['ID']
}

export type CreateEventInput = {
    name: Scalars['String']
    fromDate: Scalars['String']
    toDate: Scalars['String']
    amountOfPlayers?: Maybe<Scalars['Int']>
    web?: Maybe<Scalars['String']>
    loc?: Maybe<Scalars['String']>
    description?: Maybe<Scalars['String']>
    games: Array<Scalars['ID']>
    labels: Array<Scalars['ID']>
    newLabels: Array<NewLabelInput>
    latitude?: Maybe<Scalars['Float']>
    longitude?: Maybe<Scalars['Float']>
}

export type UpdateEventInput = {
    id: Scalars['ID']
    name: Scalars['String']
    fromDate: Scalars['String']
    toDate: Scalars['String']
    amountOfPlayers?: Maybe<Scalars['Int']>
    web?: Maybe<Scalars['String']>
    loc?: Maybe<Scalars['String']>
    description?: Maybe<Scalars['String']>
    games: Array<Scalars['ID']>
    labels: Array<Scalars['ID']>
    newLabels: Array<NewLabelInput>
    latitude?: Maybe<Scalars['Float']>
    longitude?: Maybe<Scalars['Float']>
}

export type AdminQuery = {
    __typename?: 'AdminQuery'
    allLabels: Array<Label>
    allUsers: Array<User>
    stats: Array<StatFact>
    selfRated: Array<SelfRated>
}

export type StatFact = {
    __typename?: 'StatFact'
    id: Scalars['ID']
    year: Scalars['Int']
    month: Scalars['Int']
    numRatings?: Maybe<Scalars['Int']>
    averageRating?: Maybe<Scalars['Float']>
    numComments?: Maybe<Scalars['Int']>
}

export type SelfRated = {
    __typename?: 'SelfRated'
    id: Scalars['ID']
    user: User
    game: Game
}

export type AdminMutation = {
    __typename?: 'AdminMutation'
    updateLabel: Label
    setLabelRequired: Label
    setLabelAuthorized: Label
    deleteLabel?: Maybe<Label>
    setUserRole: User
    deleteUser?: Maybe<User>
}

export type AdminMutationUpdateLabelArgs = {
    input: UpdateLabelInput
}

export type AdminMutationSetLabelRequiredArgs = {
    labelId: Scalars['ID']
    required: Scalars['Boolean']
}

export type AdminMutationSetLabelAuthorizedArgs = {
    labelId: Scalars['ID']
    authorized: Scalars['Boolean']
}

export type AdminMutationDeleteLabelArgs = {
    labelId: Scalars['ID']
}

export type AdminMutationSetUserRoleArgs = {
    userId: Scalars['ID']
    role: UserRoleIn
}

export type AdminMutationDeleteUserArgs = {
    userId: Scalars['ID']
}

export enum UserRole {
    User = 'USER',
    Editor = 'EDITOR',
    Admin = 'ADMIN',
    Author = 'AUTHOR',
    Anonymous = 'ANONYMOUS',
}

export enum UserRoleIn {
    User = 'USER',
    Editor = 'EDITOR',
    Admin = 'ADMIN',
}

export type UpdateLabelInput = {
    id: Scalars['ID']
    name: Scalars['String']
    description?: Maybe<Scalars['String']>
}

export type Donation = {
    __typename?: 'Donation'
    amount: Scalars['Float']
    donor?: Maybe<Scalars['String']>
    description?: Maybe<Scalars['String']>
}

export type Config = {
    __typename?: 'Config'
    reCaptchaKey: Scalars['String']
}

export type CreateGroupInput = {
    name: Scalars['String']
}

export type UpdateGroupInput = {
    id: Scalars['ID']
    name: Scalars['String']
}

export enum AllowedAction {
    Edit = 'Edit',
    Delete = 'Delete',
}

export type EventsPaged = {
    __typename?: 'EventsPaged'
    events: Array<Event>
    totalAmount: Scalars['Int']
}
