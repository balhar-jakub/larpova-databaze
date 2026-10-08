import {
  gameByIdResolver,
  ladderResolver,
  byQueryResolver,
  byQueryWithTotalResolver,
  gamesQueryResolver,
  gamesOfAuthorsResolver,
  commentsPagedResolver,
} from './game.js';
import { catalogResolver } from './gameCatalog.js';
import { homepageResolver, lastCommentsPage } from './homepage.js';
import { commentAsText } from './textUtils.js';
import { configResolver } from './config.js';
import {
  userByIdResolver,
  userByEmailResolver,
  loggedInUserResolver,
} from './user.js';
import {
  eventsByQueryResolver,
  usersByQueryResolver,
  usersByQueryWithTotalResolver,
  searchResolver,
} from './search.js';
import { normalizeGame, normalizeUserRef } from './mappers.js';
import { groupByIdResolver, groupsByQueryResolver } from './group.js';
import { eventByIdResolver, eventCalendarResolver, eventCalendarStatsResolver } from './event.js';
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
  startEmailLoginResolver,
} from './userMutation.js';
import {
  rateGameResolver,
  deleteGameRatingResolver,
  setGamePlayedStateResolver,
  createOrUpdateCommentResolver,
  setCommentVisibleResolver,
  setCommentLikedResolver,
  deleteCommentResolver,
  deleteGameResolver,
  restoreGameResolver,
  createGameResolver,
  updateGameResolver,
} from './gameMutation.js';
import { createGroupResolver, updateGroupResolver } from './groupMutation.js';
import { gameAllowedActions } from './gamePermissions.js';
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
import { isAtLeastEditor } from '../auth/appUsers.js';
import type { Context } from '../context.js';

export const resolvers: any = {
  Query: {
    config: configResolver,
    homepage: homepageResolver,
    gameById: gameByIdResolver,
    groupById: groupByIdResolver,
    groupsByQuery: groupsByQueryResolver,
    eventById: eventByIdResolver,
    eventCalendar: eventCalendarResolver,
    eventCalendarStats: eventCalendarStatsResolver,
    eventsByQuery: eventsByQueryResolver,
    search: searchResolver,
    userById: userByIdResolver,
    userByEmail: userByEmailResolver,
    usersByQuery: usersByQueryResolver,
    usersByQueryWithTotal: usersByQueryWithTotalResolver,
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
    catalog: catalogResolver,
  },

  AdminQuery: {
    allLabels: adminAllLabelsResolver,
    allUsers: adminAllUsersResolver,
    stats: adminStatsResolver,
    selfRated: adminSelfRatedResolver,
  },

  // Type-level field resolvers
  HomepageQuery: {
    // The block ships its own first page; "load more" is the same query with an
    // offset, so it shares the implementation instead of repeating the excludes.
    lastComments: (
      _parent: unknown,
      args: { offset?: number; limit?: number },
      ctx: any,
    ) => lastCommentsPage(ctx, args),
  },

  Game: {
    gamesOfAuthors: gamesOfAuthorsResolver,
    commentsPaged: commentsPagedResolver,
    currentUsersRating: (parent: any, _args: unknown, ctx: Context) => {
      if (!ctx.user) return null;
      const ratings = parent.csld_rating ?? [];
      return ratings.find((r: any) => r.user_id === ctx.user!.id) ?? null;
    },
    // Authors may manage the games they wrote, editors and admins any game.
    allowedActions: (parent: any, _args: unknown, ctx: any) => gameAllowedActions(parent, ctx),
  },
  Event: {
    registrationUrl: (event: any) => event.registrationUrl ?? event.registration_url ?? null,
    registrationOpen: (event: any) => event.registrationOpen ?? event.registration_open ?? false,
    allowedActions: (_parent: unknown, _args: unknown, ctx: any) =>
      isAtLeastEditor(ctx) ? ['Edit', 'Delete'] : [],
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
          commentAsText: commentAsText(c.comment),
          game: normalizeGame(c.csld_game),
          user: { id: userId, name: (parent as any).name ?? '' },
        })),
        totalAmount: total,
      };
    },

    /**
     * `email` is the account identifier — how you sign in, recover a password
     * and add a game co-author — not public profile data. Handing it to every
     * caller let anyone harvest all ~3200 addresses through `usersByQuery`
     * without signing in. Only the user themselves and staff see it.
     */
    email: (parent: any, _args: unknown, ctx: Context) => {
      if (!parent?.email) return null;
      if (ctx.user && (String(ctx.user.id) === String(parent.id) || isAtLeastEditor(ctx))) {
        return parent.email;
      }
      return null;
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
    startEmailLogin: startEmailLoginResolver,
  },

  GameMutation: {
    createGame: createGameResolver,
    updateGame: updateGameResolver,
    deleteGame: deleteGameResolver,
    restoreGame: restoreGameResolver,
    rateGame: rateGameResolver,
    deleteGameRating: deleteGameRatingResolver,
    setGamePlayedState: setGamePlayedStateResolver,
    createOrUpdateComment: createOrUpdateCommentResolver,
    setCommentVisible: setCommentVisibleResolver,
    setCommentLiked: setCommentLikedResolver,
    deleteComment: deleteCommentResolver,
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
