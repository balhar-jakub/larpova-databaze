import {
  gameByIdResolver,
  ladderResolver,
  byQueryResolver,
  byQueryWithTotalResolver,
  gamesQueryResolver,
  gamesOfAuthorsResolver,
  commentsPagedResolver,
} from './game.js';
import { homepageResolver } from './homepage.js';
import { configResolver } from './config.js';
import {
  userByIdResolver,
  userByEmailResolver,
  usersByQueryResolver,
  loggedInUserResolver,
} from './user.js';
import { normalizeGame } from './mappers.js';
import { groupByIdResolver, groupsByQueryResolver } from './group.js';
import { eventByIdResolver, eventCalendarResolver } from './event.js';
import { authorizedRequiredLabelsResolver, authorizedOptionalLabelsResolver } from './label.js';
import {
  adminResolver,
  adminAllLabelsResolver,
  adminAllUsersResolver,
  adminStatsResolver,
  adminSelfRatedResolver,
} from './admin.js';
import { donationsResolver } from './donations.js';
import {
  logInResolver,
  logOutResolver,
  createUserResolver,
  updateLoggedInUserResolver,
  updateLoggedInUserPasswordResolver,
  startRecoverPasswordResolver,
  finishRecoverPasswordResolver,
} from './userMutation.js';
import {
  rateGameResolver,
  deleteGameRatingResolver,
  setGamePlayedStateResolver,
  createOrUpdateCommentResolver,
  setCommentVisibleResolver,
  setCommentLikedResolver,
  deleteGameResolver,
  createGameResolver,
  updateGameResolver,
} from './gameMutation.js';
import { createGroupResolver, updateGroupResolver } from './groupMutation.js';
import {
  createEventResolver,
  updateEventResolver,
  deleteEventResolver,
} from './eventMutation.js';
import {
  updateLabelResolver,
  setLabelRequiredResolver,
  setLabelAuthorizedResolver,
  deleteLabelResolver,
  setUserRoleResolver,
  deleteUserResolver,
} from './adminMutation.js';

export const resolvers: any = {
  Query: {
    config: configResolver,
    homepage: homepageResolver,
    gameById: gameByIdResolver,
    groupById: groupByIdResolver,
    groupsByQuery: groupsByQueryResolver,
    eventById: eventByIdResolver,
    eventCalendar: eventCalendarResolver,
    userById: userByIdResolver,
    userByEmail: userByEmailResolver,
    usersByQuery: usersByQueryResolver,
    loggedInUser: loggedInUserResolver,
    games: gamesQueryResolver,
    authorizedRequiredLabels: authorizedRequiredLabelsResolver,
    authorizedOptionalLabels: authorizedOptionalLabelsResolver,
    admin: adminResolver,
    donations: donationsResolver,
  },

  GamesQuery: {
    byQuery: byQueryResolver,
    byQueryWithTotal: byQueryWithTotalResolver,
    ladder: ladderResolver,
  },

  AdminQuery: {
    allLabels: adminAllLabelsResolver,
    allUsers: adminAllUsersResolver,
    stats: adminStatsResolver,
    selfRated: adminSelfRatedResolver,
  },

  // Type-level field resolvers
  Game: {
    gamesOfAuthors: gamesOfAuthorsResolver,
    commentsPaged: commentsPagedResolver,
  },
  User: {
    commentsPaged: async (
      parent: { id: number | string },
      args: { offset: number; limit: number },
      ctx: Context,
    ) => {
      const userId = typeof parent.id === 'string' ? parseInt(parent.id, 10) : parent.id;
      if (!userId || isNaN(userId)) return { comments: [], totalAmount: 0 };
      const comments = await ctx.db.csld_comment.findMany({
        where: { user_id: userId, is_hidden: false },
        orderBy: { added: 'desc' },
        skip: args.offset ?? 0,
        take: args.limit ?? 10,
        include: { csld_game: true },
      });
      const total = await ctx.db.csld_comment.count({
        where: { user_id: userId, is_hidden: false },
      });
      return {
        comments: comments.map((c) => ({
          ...c,
          amountOfUpvotes: c.amount_of_upvotes ?? 0,
          commentAsText: (c.comment ?? '').replace(/<[^>]*>/g, '').trim(),
          game: normalizeGame(c.csld_game),
          user: { id: userId, name: (parent as any).name ?? '' },
        })),
        totalAmount: total,
      };
    },
  },

  // Mutations — stubs for now
  Mutation: {
    user: () => ({}),
    game: () => ({}),
    group: () => ({}),
    event: () => ({}),
    admin: () => ({}),
  },

  UserMutation: {
    logIn: logInResolver,
    logOut: logOutResolver,
    createUser: createUserResolver,
    updateLoggedInUser: updateLoggedInUserResolver,
    updateLoggedInUserPassword: updateLoggedInUserPasswordResolver,
    startRecoverPassword: startRecoverPasswordResolver,
    finishRecoverPassword: finishRecoverPasswordResolver,
  },

  GameMutation: {
    createGame: createGameResolver,
    updateGame: updateGameResolver,
    deleteGame: deleteGameResolver,
    rateGame: rateGameResolver,
    deleteGameRating: deleteGameRatingResolver,
    setGamePlayedState: setGamePlayedStateResolver,
    createOrUpdateComment: createOrUpdateCommentResolver,
    setCommentVisible: setCommentVisibleResolver,
    setCommentLiked: setCommentLikedResolver,
  },

  GroupMutation: {
    createGroup: createGroupResolver,
    updateGroup: updateGroupResolver,
  },

  EventMutation: {
    createEvent: createEventResolver,
    updateEvent: updateEventResolver,
    deleteEvent: deleteEventResolver,
  },

  AdminMutation: {
    updateLabel: updateLabelResolver,
    setLabelRequired: setLabelRequiredResolver,
    setLabelAuthorized: setLabelAuthorizedResolver,
    deleteLabel: deleteLabelResolver,
    setUserRole: setUserRoleResolver,
    deleteUser: deleteUserResolver,
  },
};
