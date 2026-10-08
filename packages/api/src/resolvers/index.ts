import {
  gameByIdResolver,
  ladderResolver,
  byQueryResolver,
  byQueryWithTotalResolver,
  gamesQueryResolver,
} from './game.js';
import { catalogResolver } from './gameCatalog.js';
import { homepageResolver } from './homepage.js';
import { configResolver } from './config.js';
import {
  userByIdResolver,
  userByEmailResolver,
  usersByQueryResolver,
  loggedInUserResolver,
} from './user.js';
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
import { isAtLeastEditor } from '../auth/appUsers.js';
import type { Context } from '../context.js';
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
    catalog: catalogResolver,
  },

  AdminQuery: {
    allLabels: adminAllLabelsResolver,
    allUsers: adminAllUsersResolver,
    stats: adminStatsResolver,
    selfRated: adminSelfRatedResolver,
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

  User: {
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

  Game: {
    // The game detail page renders its edit and delete buttons from this
    // field, so the authors have to be recognised here and not only in
    // updateGame/deleteGame.
    allowedActions: (parent: any, _args: unknown, ctx: any) => gameAllowedActions(parent, ctx),
  },

  Event: {
    registrationUrl: (event: any) => event.registrationUrl ?? event.registration_url ?? null,
    registrationOpen: (event: any) => event.registrationOpen ?? event.registration_open ?? false,
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
