export const resolvers = {
  Query: {
    homepage: () => ({
      lastAddedGames: [],
      bestRatedGames: [],
      topLabels: [],
      stats: { games: 0, events: 0, upcomingEvents: 0, users: 0, labels: 0 },
      lastComments: [],
      nextEvents: [],
    }),
    gameById: () => null,
    groupById: () => null,
    groupsByQuery: () => [],
    eventById: () => null,
    eventCalendar: () => ({ events: [], totalAmount: 0 }),
    userById: () => null,
    userByEmail: () => null,
    usersByQuery: () => [],
    games: () => ({
      byQuery: () => [],
      byQueryWithTotal: () => ({ games: [], totalAmount: 0 }),
      ladder: () => ({ games: [], totalAmount: 0 }),
    }),
    authorizedRequiredLabels: () => [],
    authorizedOptionalLabels: () => [],
    admin: () => null,
    donations: () => [],
    config: () => ({ reCaptchaKey: '' }),
    loggedInUser: () => null,
  },

  Mutation: {
    user: () => ({}),
    game: () => ({}),
    group: () => ({}),
    event: () => ({}),
    admin: () => ({}),
  },

  // Sub-mutation stubs
  UserMutation: {
    logIn: () => null,
    logOut: () => null,
    createUser: () => null,
    updateLoggedInUser: () => null,
    updateLoggedInUserPassword: () => null,
    startRecoverPassword: () => false,
    finishRecoverPassword: () => null,
  },

  GameMutation: {
    createGame: () => null,
    updateGame: () => null,
    deleteGame: () => null,
    rateGame: () => null,
    deleteGameRating: () => null,
    setGamePlayedState: () => null,
    createOrUpdateComment: () => null,
    setCommentVisible: () => null,
    setCommentLiked: () => null,
  },

  GroupMutation: {
    createGroup: () => null,
    updateGroup: () => null,
  },

  EventMutation: {
    createEvent: () => null,
    updateEvent: () => null,
    deleteEvent: () => null,
  },

  AdminMutation: {
    updateLabel: () => null,
    setLabelRequired: () => null,
    setLabelAuthorized: () => null,
    deleteLabel: () => null,
    setUserRole: () => null,
    deleteUser: () => null,
  },
};
