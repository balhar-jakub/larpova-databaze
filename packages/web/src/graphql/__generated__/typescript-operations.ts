export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type AdminMutation = {
  __typename?: 'AdminMutation';
  deleteLabel?: Maybe<Label>;
  deleteUser?: Maybe<User>;
  setLabelAuthorized: Label;
  setLabelRequired: Label;
  setUserRole: User;
  updateLabel: Label;
};


export type AdminMutationDeleteLabelArgs = {
  labelId: Scalars['ID'];
};


export type AdminMutationDeleteUserArgs = {
  userId: Scalars['ID'];
};


export type AdminMutationSetLabelAuthorizedArgs = {
  authorized: Scalars['Boolean'];
  labelId: Scalars['ID'];
};


export type AdminMutationSetLabelRequiredArgs = {
  labelId: Scalars['ID'];
  required: Scalars['Boolean'];
};


export type AdminMutationSetUserRoleArgs = {
  role: UserRoleIn;
  userId: Scalars['ID'];
};


export type AdminMutationUpdateLabelArgs = {
  input: UpdateLabelInput;
};

export type AdminQuery = {
  __typename?: 'AdminQuery';
  allLabels: Array<Label>;
  allUsers: Array<User>;
  selfRated: Array<SelfRated>;
  stats: Array<StatFact>;
};

export enum AllowedAction {
  Delete = 'Delete',
  Edit = 'Edit'
}

export type Comment = {
  __typename?: 'Comment';
  added?: Maybe<Scalars['String']>;
  amountOfUpvotes: Scalars['Int'];
  comment?: Maybe<Scalars['String']>;
  commentAsText?: Maybe<Scalars['String']>;
  game: Game;
  id: Scalars['ID'];
  isHidden?: Maybe<Scalars['Boolean']>;
  user: User;
};

export type CommentsPaged = {
  __typename?: 'CommentsPaged';
  comments: Array<Comment>;
  totalAmount: Scalars['Int'];
};

export type Config = {
  __typename?: 'Config';
  reCaptchaKey: Scalars['String'];
};

export type CreateEventInput = {
  amountOfPlayers?: InputMaybe<Scalars['Int']>;
  description?: InputMaybe<Scalars['String']>;
  fromDate: Scalars['String'];
  games: Array<Scalars['ID']>;
  labels: Array<Scalars['ID']>;
  latitude?: InputMaybe<Scalars['Float']>;
  loc?: InputMaybe<Scalars['String']>;
  longitude?: InputMaybe<Scalars['Float']>;
  name: Scalars['String'];
  newLabels: Array<NewLabelInput>;
  registrationOpen?: Scalars['Boolean'];
  registrationUrl?: InputMaybe<Scalars['String']>;
  toDate: Scalars['String'];
  web?: InputMaybe<Scalars['String']>;
};

export type CreateGameInput = {
  authors: Array<Scalars['ID']>;
  bothRole?: InputMaybe<Scalars['Int']>;
  commentsDisabled?: InputMaybe<Scalars['Boolean']>;
  coverImage?: InputMaybe<UploadedFileInput>;
  days?: InputMaybe<Scalars['Int']>;
  description: Scalars['String'];
  galleryURL?: InputMaybe<Scalars['String']>;
  groupAuthors: Array<Scalars['ID']>;
  hours?: InputMaybe<Scalars['Int']>;
  labels: Array<Scalars['ID']>;
  menRole?: InputMaybe<Scalars['Int']>;
  name: Scalars['String'];
  newAuthors: Array<NewAuthorInput>;
  newGroupAuthors: Array<NewGroupAuthorInput>;
  newLabels: Array<NewLabelInput>;
  photoAuthor?: InputMaybe<Scalars['String']>;
  players?: InputMaybe<Scalars['Int']>;
  ratingsDisabled?: InputMaybe<Scalars['Boolean']>;
  video?: InputMaybe<Scalars['String']>;
  web?: InputMaybe<Scalars['String']>;
  womenRole?: InputMaybe<Scalars['Int']>;
  year?: InputMaybe<Scalars['Int']>;
};

export type CreateGroupInput = {
  name: Scalars['String'];
};

export type CreateUserInput = {
  birthDate?: InputMaybe<Scalars['String']>;
  city?: InputMaybe<Scalars['String']>;
  email: Scalars['String'];
  name: Scalars['String'];
  nickname?: InputMaybe<Scalars['String']>;
  password: Scalars['String'];
  profilePicture?: InputMaybe<UploadedFileInput>;
  recaptcha: Scalars['String'];
};

export type Donation = {
  __typename?: 'Donation';
  amount: Scalars['Float'];
  description?: Maybe<Scalars['String']>;
  donor?: Maybe<Scalars['String']>;
};

export type Event = {
  __typename?: 'Event';
  allowedActions?: Maybe<Array<AllowedAction>>;
  amountOfPlayers?: Maybe<Scalars['Int']>;
  deleted?: Maybe<Scalars['Boolean']>;
  description?: Maybe<Scalars['String']>;
  from?: Maybe<Scalars['String']>;
  games?: Maybe<Array<Game>>;
  id: Scalars['ID'];
  labels?: Maybe<Array<Label>>;
  loc?: Maybe<Scalars['String']>;
  location?: Maybe<EventLocation>;
  name?: Maybe<Scalars['String']>;
  registrationOpen: Scalars['Boolean'];
  registrationUrl?: Maybe<Scalars['String']>;
  to?: Maybe<Scalars['String']>;
  web?: Maybe<Scalars['String']>;
};

export type EventCalendarMonthCount = {
  __typename?: 'EventCalendarMonthCount';
  count: Scalars['Int'];
  month: Scalars['Int'];
  year: Scalars['Int'];
};

export type EventCalendarStats = {
  __typename?: 'EventCalendarStats';
  byMonth: Array<EventCalendarMonthCount>;
  totalAmount: Scalars['Int'];
};

export type EventLocation = {
  __typename?: 'EventLocation';
  lattitude: Scalars['Float'];
  longtitude: Scalars['Float'];
};

export type EventMutation = {
  __typename?: 'EventMutation';
  createEvent: Event;
  deleteEvent: Event;
  updateEvent: Event;
};


export type EventMutationCreateEventArgs = {
  input: CreateEventInput;
};


export type EventMutationDeleteEventArgs = {
  eventId: Scalars['ID'];
};


export type EventMutationUpdateEventArgs = {
  input: UpdateEventInput;
};

export type EventsPaged = {
  __typename?: 'EventsPaged';
  events: Array<Event>;
  totalAmount: Scalars['Int'];
};

export type Game = {
  __typename?: 'Game';
  added: Scalars['String'];
  allowedActions?: Maybe<Array<AllowedAction>>;
  amountOfComments: Scalars['Int'];
  amountOfPlayed: Scalars['Int'];
  amountOfRatings: Scalars['Int'];
  authors: Array<User>;
  averageRating: Scalars['Float'];
  bothRole?: Maybe<Scalars['Int']>;
  comments: Array<Comment>;
  commentsDisabled?: Maybe<Scalars['Boolean']>;
  commentsPaged: CommentsPaged;
  coverImage?: Maybe<Image>;
  currentUsersComment?: Maybe<Comment>;
  currentUsersRating?: Maybe<Rating>;
  days?: Maybe<Scalars['Int']>;
  deleted?: Maybe<Scalars['Boolean']>;
  description?: Maybe<Scalars['String']>;
  events: Array<Event>;
  galleryURL?: Maybe<Scalars['String']>;
  gamesOfAuthors: Array<Game>;
  groupAuthor: Array<Group>;
  hours?: Maybe<Scalars['Int']>;
  id: Scalars['ID'];
  labels: Array<Label>;
  menRole?: Maybe<Scalars['Int']>;
  name?: Maybe<Scalars['String']>;
  photoAuthor?: Maybe<Scalars['String']>;
  photos: Array<Photo>;
  players?: Maybe<Scalars['Int']>;
  ratingStats: Array<RatingCount>;
  ratings: Array<Rating>;
  ratingsDisabled?: Maybe<Scalars['Boolean']>;
  similarGames: Array<Game>;
  totalRating: Scalars['Float'];
  video?: Maybe<Video>;
  wantsToPlay: Array<User>;
  web?: Maybe<Scalars['String']>;
  womenRole?: Maybe<Scalars['Int']>;
  year?: Maybe<Scalars['Int']>;
};


export type GameCommentsPagedArgs = {
  limit: Scalars['Int'];
  offset: Scalars['Int'];
};

export type GameCatalogCount = {
  __typename?: 'GameCatalogCount';
  count: Scalars['Int'];
  key: Scalars['String'];
};

export type GameCatalogFacets = {
  __typename?: 'GameCatalogFacets';
  durations: Array<GameCatalogCount>;
  labels: Array<GameCatalogLabelFacet>;
  yearMax?: Maybe<Scalars['Int']>;
  yearMin?: Maybe<Scalars['Int']>;
};

export type GameCatalogFilter = {
  addedWithinDays?: InputMaybe<Scalars['Int']>;
  /** Games that have all of these labels. */
  allLabels?: InputMaybe<Array<Scalars['ID']>>;
  /** Games that have at least one of these labels. */
  anyLabels?: InputMaybe<Array<Scalars['ID']>>;
  /** Duration buckets: short, day, weekend, long. */
  durations?: InputMaybe<Array<Scalars['String']>>;
  /** Minimum average rating, 0-100 (80 and up is 'recommended'). */
  minRating?: InputMaybe<Scalars['Float']>;
  /** Minimum number of ratings. */
  minRatings?: InputMaybe<Scalars['Int']>;
  /** Games that have none of these labels. */
  noLabels?: InputMaybe<Array<Scalars['ID']>>;
  playersFrom?: InputMaybe<Scalars['Int']>;
  playersTo?: InputMaybe<Scalars['Int']>;
  query?: InputMaybe<Scalars['String']>;
  withComments?: InputMaybe<Scalars['Boolean']>;
  withImage?: InputMaybe<Scalars['Boolean']>;
  yearFrom?: InputMaybe<Scalars['Int']>;
  yearTo?: InputMaybe<Scalars['Int']>;
};

export type GameCatalogLabelFacet = {
  __typename?: 'GameCatalogLabelFacet';
  count: Scalars['Int'];
  id: Scalars['ID'];
  isRequired: Scalars['Boolean'];
  name?: Maybe<Scalars['String']>;
};

export enum GameCatalogOrder {
  /** Average rating, unrated games last. */
  Best = 'Best',
  /** Most commented first. */
  MostCommented = 'MostCommented',
  /** Games people marked as played. */
  MostPlayed = 'MostPlayed',
  /** Alphabetically. */
  NameAsc = 'NameAsc',
  /** Newest first. */
  Newest = 'Newest',
  /** Bayesian average: well rated games with few ratings do not outrank proven classics. */
  Recommended = 'Recommended'
}

export type GameCatalogPaged = {
  __typename?: 'GameCatalogPaged';
  facets: GameCatalogFacets;
  games: Array<Game>;
  totalAmount: Scalars['Int'];
};

export type GameMutation = {
  __typename?: 'GameMutation';
  createGame: Game;
  createOrUpdateComment: Game;
  deleteComment: Game;
  deleteGame: Game;
  deleteGameRating: Game;
  rateGame: Game;
  setCommentLiked: Game;
  setCommentVisible: Game;
  setGamePlayedState: Game;
  updateGame: Game;
};


export type GameMutationCreateGameArgs = {
  input: CreateGameInput;
};


export type GameMutationCreateOrUpdateCommentArgs = {
  comment: Scalars['String'];
  gameId: Scalars['ID'];
};


export type GameMutationDeleteCommentArgs = {
  commentId: Scalars['ID'];
};


export type GameMutationDeleteGameArgs = {
  gameId: Scalars['ID'];
};


export type GameMutationDeleteGameRatingArgs = {
  gameId: Scalars['ID'];
  userId?: InputMaybe<Scalars['ID']>;
};


export type GameMutationRateGameArgs = {
  gameId: Scalars['ID'];
  rating?: InputMaybe<Scalars['Int']>;
};


export type GameMutationSetCommentLikedArgs = {
  commentId: Scalars['ID'];
  liked: Scalars['Boolean'];
};


export type GameMutationSetCommentVisibleArgs = {
  commentId: Scalars['ID'];
  visible: Scalars['Boolean'];
};


export type GameMutationSetGamePlayedStateArgs = {
  gameId: Scalars['ID'];
  state: Scalars['Int'];
};


export type GameMutationUpdateGameArgs = {
  input: UpdateGameInput;
};

export type GameWithRating = {
  __typename?: 'GameWithRating';
  game: Game;
  rating?: Maybe<Scalars['Int']>;
};

export type GamesPaged = {
  __typename?: 'GamesPaged';
  games: Array<Game>;
  totalAmount: Scalars['Int'];
};

export type GamesQuery = {
  __typename?: 'GamesQuery';
  byQuery: Array<Game>;
  byQueryWithTotal: GamesPaged;
  /** Browsable catalog with filters and facet counts — the replacement for the ladder tabs. */
  catalog: GameCatalogPaged;
  ladder: GamesPaged;
};


export type GamesQueryByQueryArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  query: Scalars['String'];
};


export type GamesQueryByQueryWithTotalArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  query: Scalars['String'];
};


export type GamesQueryCatalogArgs = {
  filter?: InputMaybe<GameCatalogFilter>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order?: InputMaybe<GameCatalogOrder>;
};


export type GamesQueryLadderArgs = {
  ladderType: LadderType;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  otherLabels?: InputMaybe<Array<Scalars['ID']>>;
  requiredLabels?: InputMaybe<Array<Scalars['ID']>>;
};

export type Group = {
  __typename?: 'Group';
  authorsOf: Array<Game>;
  id: Scalars['ID'];
  name?: Maybe<Scalars['String']>;
};

export type GroupMutation = {
  __typename?: 'GroupMutation';
  createGroup: Group;
  updateGroup: Group;
};


export type GroupMutationCreateGroupArgs = {
  input?: InputMaybe<CreateGroupInput>;
};


export type GroupMutationUpdateGroupArgs = {
  input?: InputMaybe<UpdateGroupInput>;
};

export type HomepageQuery = {
  __typename?: 'HomepageQuery';
  lastAddedGames: Array<Game>;
  lastComments: Array<Comment>;
  mostPopularGames: Array<Game>;
  nextEvents: Array<Event>;
};


export type HomepageQueryLastCommentsArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};

export type Image = {
  __typename?: 'Image';
  contentType?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  path?: Maybe<Scalars['String']>;
};

export type Label = {
  __typename?: 'Label';
  description?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  isAuthorized?: Maybe<Scalars['Boolean']>;
  isRequired?: Maybe<Scalars['Boolean']>;
  name?: Maybe<Scalars['String']>;
};

export enum LadderType {
  Best = 'Best',
  MostCommented = 'MostCommented',
  MostPlayed = 'MostPlayed',
  Recent = 'Recent',
  RecentAndMostPlayed = 'RecentAndMostPlayed'
}

export type Mutation = {
  __typename?: 'Mutation';
  admin: AdminMutation;
  event: EventMutation;
  game: GameMutation;
  group: GroupMutation;
  user: UserMutation;
};

export type NewAuthorInput = {
  email?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
  nickname?: InputMaybe<Scalars['String']>;
};

export type NewGroupAuthorInput = {
  name: Scalars['String'];
};

export type NewLabelInput = {
  description?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
};

export type Photo = {
  __typename?: 'Photo';
  description?: Maybe<Scalars['String']>;
  featured: Scalars['Boolean'];
  fullHeight: Scalars['Int'];
  fullWidth: Scalars['Int'];
  game: Game;
  id: Scalars['ID'];
  image: Image;
  orderSeq?: Maybe<Scalars['Int']>;
};

export type Query = {
  __typename?: 'Query';
  admin: AdminQuery;
  authorizedOptionalLabels: Array<Label>;
  authorizedRequiredLabels: Array<Label>;
  config: Config;
  donations: Array<Donation>;
  eventById?: Maybe<Event>;
  eventCalendar: EventsPaged;
  eventCalendarStats: EventCalendarStats;
  gameById?: Maybe<Game>;
  games: GamesQuery;
  groupById?: Maybe<Group>;
  groupsByQuery: Array<Group>;
  homepage: HomepageQuery;
  loggedInUser?: Maybe<User>;
  userByEmail?: Maybe<User>;
  userById?: Maybe<User>;
  usersByQuery: Array<User>;
};


export type QueryEventByIdArgs = {
  eventId: Scalars['ID'];
};


export type QueryEventCalendarArgs = {
  from?: InputMaybe<Scalars['String']>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  otherLabels?: InputMaybe<Array<Scalars['ID']>>;
  requiredLabels?: InputMaybe<Array<Scalars['ID']>>;
  to?: InputMaybe<Scalars['String']>;
};


export type QueryEventCalendarStatsArgs = {
  from?: InputMaybe<Scalars['String']>;
  to?: InputMaybe<Scalars['String']>;
};


export type QueryGameByIdArgs = {
  gameId: Scalars['ID'];
};


export type QueryGroupByIdArgs = {
  groupId: Scalars['ID'];
};


export type QueryGroupsByQueryArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  query: Scalars['String'];
};


export type QueryUserByEmailArgs = {
  email: Scalars['String'];
};


export type QueryUserByIdArgs = {
  userId: Scalars['ID'];
};


export type QueryUsersByQueryArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  query: Scalars['String'];
};

export type Rating = {
  __typename?: 'Rating';
  game: Game;
  id: Scalars['ID'];
  rating?: Maybe<Scalars['Int']>;
  state?: Maybe<Scalars['Int']>;
  user: User;
};

export type RatingCount = {
  __typename?: 'RatingCount';
  count: Scalars['Int'];
  rating: Scalars['Int'];
};

export type SelfRated = {
  __typename?: 'SelfRated';
  game: Game;
  id: Scalars['ID'];
  user: User;
};

export type StatFact = {
  __typename?: 'StatFact';
  averageRating?: Maybe<Scalars['Float']>;
  id: Scalars['ID'];
  month: Scalars['Int'];
  numComments?: Maybe<Scalars['Int']>;
  numRatings?: Maybe<Scalars['Int']>;
  year: Scalars['Int'];
};

export type UpdateEventInput = {
  amountOfPlayers?: InputMaybe<Scalars['Int']>;
  description?: InputMaybe<Scalars['String']>;
  fromDate: Scalars['String'];
  games: Array<Scalars['ID']>;
  id: Scalars['ID'];
  labels: Array<Scalars['ID']>;
  latitude?: InputMaybe<Scalars['Float']>;
  loc?: InputMaybe<Scalars['String']>;
  longitude?: InputMaybe<Scalars['Float']>;
  name: Scalars['String'];
  newLabels: Array<NewLabelInput>;
  registrationOpen?: Scalars['Boolean'];
  registrationUrl?: InputMaybe<Scalars['String']>;
  toDate: Scalars['String'];
  web?: InputMaybe<Scalars['String']>;
};

export type UpdateGameInput = {
  authors: Array<Scalars['ID']>;
  bothRole?: InputMaybe<Scalars['Int']>;
  commentsDisabled?: InputMaybe<Scalars['Boolean']>;
  coverImage?: InputMaybe<UploadedFileInput>;
  days?: InputMaybe<Scalars['Int']>;
  description: Scalars['String'];
  galleryURL?: InputMaybe<Scalars['String']>;
  groupAuthors: Array<Scalars['ID']>;
  hours?: InputMaybe<Scalars['Int']>;
  id: Scalars['ID'];
  labels: Array<Scalars['ID']>;
  menRole?: InputMaybe<Scalars['Int']>;
  name: Scalars['String'];
  newAuthors: Array<NewAuthorInput>;
  newGroupAuthors: Array<NewGroupAuthorInput>;
  newLabels: Array<NewLabelInput>;
  photoAuthor?: InputMaybe<Scalars['String']>;
  players?: InputMaybe<Scalars['Int']>;
  ratingsDisabled?: InputMaybe<Scalars['Boolean']>;
  video?: InputMaybe<Scalars['String']>;
  web?: InputMaybe<Scalars['String']>;
  womenRole?: InputMaybe<Scalars['Int']>;
  year?: InputMaybe<Scalars['Int']>;
};

export type UpdateGroupInput = {
  id: Scalars['ID'];
  name: Scalars['String'];
};

export type UpdateLabelInput = {
  description?: InputMaybe<Scalars['String']>;
  id: Scalars['ID'];
  name: Scalars['String'];
};

export type UpdateLoggedInUserInput = {
  birthDate?: InputMaybe<Scalars['String']>;
  city?: InputMaybe<Scalars['String']>;
  /** Short public bio shown on the user's profile. */
  description?: InputMaybe<Scalars['String']>;
  email: Scalars['String'];
  name: Scalars['String'];
  nickname?: InputMaybe<Scalars['String']>;
  profilePicture?: InputMaybe<UploadedFileInput>;
};

export type UploadedFileInput = {
  contents: Scalars['String'];
  fileName: Scalars['String'];
};

export type User = {
  __typename?: 'User';
  amountOfComments?: Maybe<Scalars['Int']>;
  amountOfCreated?: Maybe<Scalars['Int']>;
  amountOfPlayed?: Maybe<Scalars['Int']>;
  authoredGames: Array<Game>;
  birthDate?: Maybe<Scalars['String']>;
  city?: Maybe<Scalars['String']>;
  commentsPaged: CommentsPaged;
  description?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  image?: Maybe<Image>;
  lastRating?: Maybe<Scalars['Int']>;
  name: Scalars['String'];
  nickname?: Maybe<Scalars['String']>;
  playedGames: Array<GameWithRating>;
  ratings: Array<Rating>;
  role?: Maybe<UserRole>;
  wantedGames: Array<Game>;
};


export type UserCommentsPagedArgs = {
  limit: Scalars['Int'];
  offset: Scalars['Int'];
};

export type UserMutation = {
  __typename?: 'UserMutation';
  createUser?: Maybe<User>;
  finishRecoverPassword?: Maybe<User>;
  logIn?: Maybe<User>;
  logOut?: Maybe<User>;
  startEmailLogin: Scalars['Boolean'];
  startRecoverPassword?: Maybe<Scalars['Boolean']>;
  updateLoggedInUser: User;
  updateLoggedInUserPassword: User;
};


export type UserMutationCreateUserArgs = {
  input: CreateUserInput;
};


export type UserMutationFinishRecoverPasswordArgs = {
  newPassword: Scalars['String'];
  token: Scalars['String'];
};


export type UserMutationLogInArgs = {
  password: Scalars['String'];
  userName: Scalars['String'];
};


export type UserMutationStartEmailLoginArgs = {
  email: Scalars['String'];
  loginUrlTemplate: Scalars['String'];
};


export type UserMutationStartRecoverPasswordArgs = {
  email: Scalars['String'];
  recoverUrl: Scalars['String'];
};


export type UserMutationUpdateLoggedInUserArgs = {
  input: UpdateLoggedInUserInput;
};


export type UserMutationUpdateLoggedInUserPasswordArgs = {
  newPassword: Scalars['String'];
  oldPassword: Scalars['String'];
};

export enum UserRole {
  Admin = 'ADMIN',
  Anonymous = 'ANONYMOUS',
  Author = 'AUTHOR',
  Editor = 'EDITOR',
  User = 'USER'
}

export enum UserRoleIn {
  Admin = 'ADMIN',
  Editor = 'EDITOR',
  User = 'USER'
}

export type Video = {
  __typename?: 'Video';
  id: Scalars['ID'];
  path?: Maybe<Scalars['String']>;
};

export type DeleteLabelMutationVariables = Exact<{
  labelId: Scalars['ID'];
}>;


export type DeleteLabelMutation = { __typename?: 'Mutation', admin: { __typename?: 'AdminMutation', deleteLabel?: { __typename?: 'Label', id: string } | null } };

export type DeleteUserMutationVariables = Exact<{
  userId: Scalars['ID'];
}>;


export type DeleteUserMutation = { __typename?: 'Mutation', admin: { __typename?: 'AdminMutation', deleteUser?: { __typename?: 'User', id: string } | null } };

export type AdminLabelFieldsFragment = { __typename?: 'Label', id: string, name?: string | null, description?: string | null, isAuthorized?: boolean | null, isRequired?: boolean | null };

export type LoadAllLabelsQueryVariables = Exact<{ [key: string]: never; }>;


export type LoadAllLabelsQuery = { __typename?: 'Query', admin: { __typename?: 'AdminQuery', allLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null, isAuthorized?: boolean | null, isRequired?: boolean | null }> } };

export type LoadAllUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type LoadAllUsersQuery = { __typename?: 'Query', admin: { __typename?: 'AdminQuery', allUsers: Array<{ __typename?: 'User', id: string, name: string, nickname?: string | null, role?: UserRole | null }> } };

export type LoadSelfRatedQueryVariables = Exact<{ [key: string]: never; }>;


export type LoadSelfRatedQuery = { __typename?: 'Query', admin: { __typename?: 'AdminQuery', selfRated: Array<{ __typename?: 'SelfRated', game: { __typename?: 'Game', id: string, name?: string | null }, user: { __typename?: 'User', id: string, email?: string | null, name: string, nickname?: string | null } }> } };

export type LoadStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type LoadStatsQuery = { __typename?: 'Query', admin: { __typename?: 'AdminQuery', stats: Array<{ __typename?: 'StatFact', id: string, year: number, month: number, averageRating?: number | null, numRatings?: number | null, numComments?: number | null }> } };

export type SetLabelAuthorizedMutationVariables = Exact<{
  labelId: Scalars['ID'];
  authorized: Scalars['Boolean'];
}>;


export type SetLabelAuthorizedMutation = { __typename?: 'Mutation', admin: { __typename?: 'AdminMutation', setLabelAuthorized: { __typename?: 'Label', id: string, name?: string | null, description?: string | null, isAuthorized?: boolean | null, isRequired?: boolean | null } } };

export type SetLabelRequiredMutationVariables = Exact<{
  labelId: Scalars['ID'];
  required: Scalars['Boolean'];
}>;


export type SetLabelRequiredMutation = { __typename?: 'Mutation', admin: { __typename?: 'AdminMutation', setLabelRequired: { __typename?: 'Label', id: string, name?: string | null, description?: string | null, isAuthorized?: boolean | null, isRequired?: boolean | null } } };

export type UpdateLabelMutationVariables = Exact<{
  input: UpdateLabelInput;
}>;


export type UpdateLabelMutation = { __typename?: 'Mutation', admin: { __typename?: 'AdminMutation', updateLabel: { __typename?: 'Label', id: string, name?: string | null, description?: string | null, isAuthorized?: boolean | null, isRequired?: boolean | null } } };

export type UpdateUserRoleMutationVariables = Exact<{
  userId: Scalars['ID'];
  role: UserRoleIn;
}>;


export type UpdateUserRoleMutation = { __typename?: 'Mutation', admin: { __typename?: 'AdminMutation', setUserRole: { __typename?: 'User', id: string, name: string, nickname?: string | null, role?: UserRole | null } } };

export type AdminUserFieldsFragment = { __typename?: 'User', id: string, name: string, nickname?: string | null, role?: UserRole | null };

export type CalendarEventDataFragment = { __typename?: 'Event', id: string, name?: string | null, from?: string | null, to?: string | null, loc?: string | null, web?: string | null, registrationUrl?: string | null, registrationOpen: boolean, amountOfPlayers?: number | null, labels?: Array<{ __typename?: 'Label', id: string, name?: string | null }> | null, games?: Array<{ __typename?: 'Game', id: string, name?: string | null }> | null };

export type CalendarEventsQueryVariables = Exact<{
  from?: InputMaybe<Scalars['String']>;
  to?: InputMaybe<Scalars['String']>;
  offset: Scalars['Int'];
  limit: Scalars['Int'];
}>;


export type CalendarEventsQuery = { __typename?: 'Query', eventCalendar: { __typename?: 'EventsPaged', totalAmount: number, events: Array<{ __typename?: 'Event', id: string, name?: string | null, from?: string | null, to?: string | null, loc?: string | null, web?: string | null, registrationUrl?: string | null, registrationOpen: boolean, amountOfPlayers?: number | null, labels?: Array<{ __typename?: 'Label', id: string, name?: string | null }> | null, games?: Array<{ __typename?: 'Game', id: string, name?: string | null }> | null }> } };

export type CalendarStatsQueryVariables = Exact<{
  from?: InputMaybe<Scalars['String']>;
  to?: InputMaybe<Scalars['String']>;
}>;


export type CalendarStatsQuery = { __typename?: 'Query', eventCalendarStats: { __typename?: 'EventCalendarStats', totalAmount: number, byMonth: Array<{ __typename?: 'EventCalendarMonthCount', year: number, month: number, count: number }> } };

export type CatalogGameDataFragment = { __typename?: 'Game', id: string, name?: string | null, year?: number | null, hours?: number | null, days?: number | null, players?: number | null, amountOfComments: number, amountOfRatings: number, amountOfPlayed: number, averageRating: number, coverImage?: { __typename?: 'Image', id: string } | null, labels: Array<{ __typename?: 'Label', id: string, name?: string | null }> };

export type CatalogGamesQueryVariables = Exact<{
  filter?: InputMaybe<GameCatalogFilter>;
  order?: InputMaybe<GameCatalogOrder>;
  offset: Scalars['Int'];
  limit: Scalars['Int'];
}>;


export type CatalogGamesQuery = { __typename?: 'Query', games: { __typename?: 'GamesQuery', catalog: { __typename?: 'GameCatalogPaged', totalAmount: number, games: Array<{ __typename?: 'Game', id: string, name?: string | null, year?: number | null, hours?: number | null, days?: number | null, players?: number | null, amountOfComments: number, amountOfRatings: number, amountOfPlayed: number, averageRating: number, coverImage?: { __typename?: 'Image', id: string } | null, labels: Array<{ __typename?: 'Label', id: string, name?: string | null }> }>, facets: { __typename?: 'GameCatalogFacets', yearMin?: number | null, yearMax?: number | null, labels: Array<{ __typename?: 'GameCatalogLabelFacet', id: string, name?: string | null, count: number, isRequired: boolean }>, durations: Array<{ __typename?: 'GameCatalogCount', key: string, count: number }> } } } };

export type CatalogMoreGamesQueryVariables = Exact<{
  filter?: InputMaybe<GameCatalogFilter>;
  order?: InputMaybe<GameCatalogOrder>;
  offset: Scalars['Int'];
  limit: Scalars['Int'];
}>;


export type CatalogMoreGamesQuery = { __typename?: 'Query', games: { __typename?: 'GamesQuery', catalog: { __typename?: 'GameCatalogPaged', totalAmount: number, games: Array<{ __typename?: 'Game', id: string, name?: string | null, year?: number | null, hours?: number | null, days?: number | null, players?: number | null, amountOfComments: number, amountOfRatings: number, amountOfPlayed: number, averageRating: number, coverImage?: { __typename?: 'Image', id: string } | null, labels: Array<{ __typename?: 'Label', id: string, name?: string | null }> }> } } };

export type DeleteEventMutationVariables = Exact<{
  eventId: Scalars['ID'];
}>;


export type DeleteEventMutation = { __typename?: 'Mutation', event: { __typename?: 'EventMutation', deleteEvent: { __typename?: 'Event', id: string } } };

export type LoadEventQueryVariables = Exact<{
  eventId: Scalars['ID'];
}>;


export type LoadEventQuery = { __typename?: 'Query', eventById?: { __typename?: 'Event', id: string, name?: string | null, amountOfPlayers?: number | null, web?: string | null, registrationUrl?: string | null, registrationOpen: boolean, loc?: string | null, from?: string | null, to?: string | null, description?: string | null, allowedActions?: Array<AllowedAction> | null, labels?: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null, isRequired?: boolean | null }> | null, games?: Array<{ __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }> | null } | null };

export type AutoCompleteGamesQueryVariables = Exact<{
  query: Scalars['String'];
  offset: Scalars['Int'];
  limit: Scalars['Int'];
}>;


export type AutoCompleteGamesQuery = { __typename?: 'Query', games: { __typename?: 'GamesQuery', byQuery: Array<{ __typename?: 'Game', id: string, name?: string | null, year?: number | null }> } };

export type CreateEventMutationVariables = Exact<{
  input: CreateEventInput;
}>;


export type CreateEventMutation = { __typename?: 'Mutation', event: { __typename?: 'EventMutation', createEvent: { __typename?: 'Event', id: string, name?: string | null } } };

export type LoadEventForEditQueryVariables = Exact<{
  eventId: Scalars['ID'];
}>;


export type LoadEventForEditQuery = { __typename?: 'Query', eventById?: { __typename?: 'Event', id: string, name?: string | null, from?: string | null, to?: string | null, amountOfPlayers?: number | null, web?: string | null, registrationUrl?: string | null, registrationOpen: boolean, loc?: string | null, description?: string | null, games?: Array<{ __typename?: 'Game', id: string, name?: string | null, year?: number | null }> | null, labels?: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null, isRequired?: boolean | null }> | null } | null, authorizedRequiredLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null }>, authorizedOptionalLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null }> };

export type UpdateEventMutationVariables = Exact<{
  input: UpdateEventInput;
}>;


export type UpdateEventMutation = { __typename?: 'Mutation', event: { __typename?: 'EventMutation', updateEvent: { __typename?: 'Event', id: string, name?: string | null } } };

export type CachedGameDataFragment = { __typename?: 'Game', id: string, name?: string | null, averageRating: number, amountOfRatings: number };

export type DeleteCommentMutationVariables = Exact<{
  commentId: Scalars['ID'];
}>;


export type DeleteCommentMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', deleteComment: { __typename?: 'Game', id: string } } };

export type DeleteGameMutationVariables = Exact<{
  gameId: Scalars['ID'];
}>;


export type DeleteGameMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', deleteGame: { __typename?: 'Game', id: string } } };

export type DeleteRatingMutationVariables = Exact<{
  gameId: Scalars['ID'];
  userId: Scalars['ID'];
}>;


export type DeleteRatingMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', deleteGameRating: { __typename?: 'Game', id: string, averageRating: number, totalRating: number, amountOfRatings: number, amountOfPlayed: number, currentUsersRating?: { __typename?: 'Rating', id: string, rating?: number | null, state?: number | null } | null, ratingStats: Array<{ __typename?: 'RatingCount', count: number, rating: number }>, ratings: Array<{ __typename?: 'Rating', id: string, rating?: number | null, user: { __typename?: 'User', id: string, name: string } }> } } };

export type GameRatingsUpdateFragment = { __typename?: 'Game', id: string, averageRating: number, totalRating: number, amountOfRatings: number, amountOfPlayed: number, currentUsersRating?: { __typename?: 'Rating', id: string, rating?: number | null, state?: number | null } | null, ratingStats: Array<{ __typename?: 'RatingCount', count: number, rating: number }>, ratings: Array<{ __typename?: 'Rating', id: string, rating?: number | null, user: { __typename?: 'User', id: string, name: string } }> };

export type GameDetailQueryVariables = Exact<{
  gameId: Scalars['ID'];
}>;


export type GameDetailQuery = { __typename?: 'Query', gameById?: { __typename?: 'Game', id: string, name?: string | null, players?: number | null, menRole?: number | null, womenRole?: number | null, bothRole?: number | null, hours?: number | null, days?: number | null, year?: number | null, web?: string | null, galleryURL?: string | null, photoAuthor?: string | null, description?: string | null, averageRating: number, amountOfRatings: number, amountOfPlayed: number, commentsDisabled?: boolean | null, ratingsDisabled?: boolean | null, allowedActions?: Array<AllowedAction> | null, coverImage?: { __typename?: 'Image', id: string } | null, currentUsersRating?: { __typename?: 'Rating', id: string, rating?: number | null, state?: number | null } | null, labels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null, isRequired?: boolean | null }>, ratingStats: Array<{ __typename?: 'RatingCount', count: number, rating: number }>, video?: { __typename?: 'Video', id: string, path?: string | null } | null, authors: Array<{ __typename?: 'User', id: string, name: string, nickname?: string | null }>, groupAuthor: Array<{ __typename?: 'Group', id: string, name?: string | null }>, similarGames: Array<{ __typename?: 'Game', id: string, name?: string | null, averageRating: number, amountOfRatings: number, year?: number | null }>, gamesOfAuthors: Array<{ __typename?: 'Game', id: string, name?: string | null, averageRating: number, amountOfRatings: number, year?: number | null }>, events: Array<{ __typename?: 'Event', id: string, name?: string | null, from?: string | null, to?: string | null }>, ratings: Array<{ __typename?: 'Rating', id: string, rating?: number | null, user: { __typename?: 'User', id: string, name: string } }> } | null };

export type MoreCommentsQueryVariables = Exact<{
  gameId: Scalars['ID'];
  commentsOffset: Scalars['Int'];
  commentsLimit: Scalars['Int'];
}>;


export type MoreCommentsQuery = { __typename?: 'Query', gameById?: { __typename?: 'Game', id: string, commentsPaged: { __typename?: 'CommentsPaged', totalAmount: number, comments: Array<{ __typename?: 'Comment', id: string, added?: string | null, amountOfUpvotes: number, comment?: string | null, isHidden?: boolean | null, user: { __typename?: 'User', id: string, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string } | null } }> }, currentUsersComment?: { __typename?: 'Comment', id: string, comment?: string | null } | null } | null };

export type UpdateCommentMutationVariables = Exact<{
  gameId: Scalars['ID'];
  comment: Scalars['String'];
}>;


export type UpdateCommentMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', createOrUpdateComment: { __typename?: 'Game', id: string } } };

export type UpdateGameRatingMutationVariables = Exact<{
  gameId: Scalars['ID'];
  rating: Scalars['Int'];
}>;


export type UpdateGameRatingMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', rateGame: { __typename?: 'Game', id: string, averageRating: number, totalRating: number, amountOfRatings: number, amountOfPlayed: number, currentUsersRating?: { __typename?: 'Rating', id: string, rating?: number | null, state?: number | null } | null, ratingStats: Array<{ __typename?: 'RatingCount', count: number, rating: number }>, ratings: Array<{ __typename?: 'Rating', id: string, rating?: number | null, user: { __typename?: 'User', id: string, name: string } }> } } };

export type UpdateGameStateMutationVariables = Exact<{
  gameId: Scalars['ID'];
  state: Scalars['Int'];
}>;


export type UpdateGameStateMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', setGamePlayedState: { __typename?: 'Game', id: string, averageRating: number, totalRating: number, amountOfRatings: number, amountOfPlayed: number, currentUsersRating?: { __typename?: 'Rating', id: string, rating?: number | null, state?: number | null } | null, ratingStats: Array<{ __typename?: 'RatingCount', count: number, rating: number }>, ratings: Array<{ __typename?: 'Rating', id: string, rating?: number | null, user: { __typename?: 'User', id: string, name: string } }> } } };

export type CreateGameMutationVariables = Exact<{
  input: CreateGameInput;
}>;


export type CreateGameMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', createGame: { __typename?: 'Game', id: string, name?: string | null } } };

export type LoadGameForEditQueryVariables = Exact<{
  gameId: Scalars['ID'];
}>;


export type LoadGameForEditQuery = { __typename?: 'Query', gameById?: { __typename?: 'Game', id: string, name?: string | null, description?: string | null, year?: number | null, players?: number | null, womenRole?: number | null, menRole?: number | null, bothRole?: number | null, hours?: number | null, days?: number | null, web?: string | null, photoAuthor?: string | null, galleryURL?: string | null, ratingsDisabled?: boolean | null, commentsDisabled?: boolean | null, authors: Array<{ __typename?: 'User', id: string, name: string, nickname?: string | null }>, groupAuthor: Array<{ __typename?: 'Group', id: string, name?: string | null }>, video?: { __typename?: 'Video', id: string, path?: string | null } | null, labels: Array<{ __typename?: 'Label', id: string, isRequired?: boolean | null }> } | null, authorizedRequiredLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null }>, authorizedOptionalLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null }> };

export type SearchAuthorsQueryVariables = Exact<{
  query: Scalars['String'];
  offset: Scalars['Int'];
  limit: Scalars['Int'];
}>;


export type SearchAuthorsQuery = { __typename?: 'Query', usersByQuery: Array<{ __typename?: 'User', id: string, name: string, nickname?: string | null, birthDate?: string | null }> };

export type SearchGroupsQueryVariables = Exact<{
  query: Scalars['String'];
  offset: Scalars['Int'];
  limit: Scalars['Int'];
}>;


export type SearchGroupsQuery = { __typename?: 'Query', groupsByQuery: Array<{ __typename?: 'Group', id: string, name?: string | null }> };

export type UpdateGameMutationVariables = Exact<{
  input: UpdateGameInput;
}>;


export type UpdateGameMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', updateGame: { __typename?: 'Game', id: string, name?: string | null } } };

export type CreateGroupMutationVariables = Exact<{
  input: CreateGroupInput;
}>;


export type CreateGroupMutation = { __typename?: 'Mutation', group: { __typename?: 'GroupMutation', createGroup: { __typename?: 'Group', id: string } } };

export type LoadGroupQueryVariables = Exact<{
  groupId: Scalars['ID'];
}>;


export type LoadGroupQuery = { __typename?: 'Query', groupById?: { __typename?: 'Group', id: string, name?: string | null, authorsOf: Array<{ __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }> } | null };

export type UpdateGroupMutationVariables = Exact<{
  input: UpdateGroupInput;
}>;


export type UpdateGroupMutation = { __typename?: 'Mutation', group: { __typename?: 'GroupMutation', updateGroup: { __typename?: 'Group', id: string } } };

export type BaseCommentDataFragment = { __typename?: 'Comment', id: string, commentAsText?: string | null, added?: string | null, game: { __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }, user: { __typename?: 'User', id: string, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string, path?: string | null } | null } };

export type GetHomePageDataQueryVariables = Exact<{ [key: string]: never; }>;


export type GetHomePageDataQuery = { __typename?: 'Query', homepage: { __typename?: 'HomepageQuery', lastAddedGames: Array<{ __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }>, mostPopularGames: Array<{ __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }>, nextEvents: Array<{ __typename?: 'Event', id: string, name?: string | null, from?: string | null, to?: string | null, loc?: string | null, amountOfPlayers?: number | null }>, lastComments: Array<{ __typename?: 'Comment', id: string, commentAsText?: string | null, added?: string | null, game: { __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }, user: { __typename?: 'User', id: string, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string, path?: string | null } | null } }> } };

export type GetMoreLastCommentsQueryVariables = Exact<{
  offset?: InputMaybe<Scalars['Int']>;
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type GetMoreLastCommentsQuery = { __typename?: 'Query', homepage: { __typename?: 'HomepageQuery', lastComments: Array<{ __typename?: 'Comment', id: string, commentAsText?: string | null, added?: string | null, game: { __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }, user: { __typename?: 'User', id: string, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string, path?: string | null } | null } }> } };

export type ChangePasswordMutationVariables = Exact<{
  oldPassword: Scalars['String'];
  newPassword: Scalars['String'];
}>;


export type ChangePasswordMutation = { __typename?: 'Mutation', user: { __typename?: 'UserMutation', updateLoggedInUserPassword: { __typename?: 'User', id: string } } };

export type UserProfileDataFragment = { __typename?: 'User', id: string, amountOfPlayed?: number | null, amountOfCreated?: number | null, name: string, nickname?: string | null, birthDate?: string | null, city?: string | null, description?: string | null, image?: { __typename?: 'Image', id: string } | null, authoredGames: Array<{ __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }>, playedGames: Array<{ __typename?: 'GameWithRating', rating?: number | null, game: { __typename?: 'Game', year?: number | null, id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number } }>, wantedGames: Array<{ __typename?: 'Game', year?: number | null, id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }> };

export type LoadCurrentUserProfileQueryVariables = Exact<{
  commentsLimit: Scalars['Int'];
}>;


export type LoadCurrentUserProfileQuery = { __typename?: 'Query', loggedInUser?: { __typename?: 'User', id: string, amountOfPlayed?: number | null, amountOfCreated?: number | null, name: string, nickname?: string | null, birthDate?: string | null, city?: string | null, description?: string | null, commentsPaged: { __typename?: 'CommentsPaged', totalAmount: number, comments: Array<{ __typename?: 'Comment', id: string, added?: string | null, amountOfUpvotes: number, comment?: string | null, isHidden?: boolean | null, game: { __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }, user: { __typename?: 'User', id: string, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string } | null } }> }, image?: { __typename?: 'Image', id: string } | null, authoredGames: Array<{ __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }>, playedGames: Array<{ __typename?: 'GameWithRating', rating?: number | null, game: { __typename?: 'Game', year?: number | null, id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number } }>, wantedGames: Array<{ __typename?: 'Game', year?: number | null, id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }> } | null };

export type LoadCurrentUserSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type LoadCurrentUserSettingsQuery = { __typename?: 'Query', loggedInUser?: { __typename?: 'User', id: string, amountOfPlayed?: number | null, amountOfCreated?: number | null, email?: string | null, name: string, nickname?: string | null, birthDate?: string | null, city?: string | null, description?: string | null, image?: { __typename?: 'Image', id: string } | null } | null };

export type LoadUserProfileQueryVariables = Exact<{
  userId: Scalars['ID'];
  commentsLimit: Scalars['Int'];
}>;


export type LoadUserProfileQuery = { __typename?: 'Query', loggedInUser?: { __typename?: 'User', id: string } | null, userById?: { __typename?: 'User', id: string, amountOfPlayed?: number | null, amountOfCreated?: number | null, name: string, nickname?: string | null, birthDate?: string | null, city?: string | null, description?: string | null, commentsPaged: { __typename?: 'CommentsPaged', totalAmount: number, comments: Array<{ __typename?: 'Comment', id: string, added?: string | null, amountOfUpvotes: number, comment?: string | null, isHidden?: boolean | null, game: { __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }, user: { __typename?: 'User', id: string, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string } | null } }> }, image?: { __typename?: 'Image', id: string } | null, authoredGames: Array<{ __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }>, playedGames: Array<{ __typename?: 'GameWithRating', rating?: number | null, game: { __typename?: 'Game', year?: number | null, id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number } }>, wantedGames: Array<{ __typename?: 'Game', year?: number | null, id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }> } | null };

export type MoreUserCommentsQueryVariables = Exact<{
  userId: Scalars['ID'];
  offset: Scalars['Int'];
  limit: Scalars['Int'];
}>;


export type MoreUserCommentsQuery = { __typename?: 'Query', userById?: { __typename?: 'User', commentsPaged: { __typename?: 'CommentsPaged', totalAmount: number, comments: Array<{ __typename?: 'Comment', id: string, added?: string | null, amountOfUpvotes: number, comment?: string | null, isHidden?: boolean | null, game: { __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }, user: { __typename?: 'User', id: string, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string } | null } }> } } | null };

export type UpdateUserSettingsMutationVariables = Exact<{
  input: UpdateLoggedInUserInput;
}>;


export type UpdateUserSettingsMutation = { __typename?: 'Mutation', user: { __typename?: 'UserMutation', updateLoggedInUser: { __typename?: 'User', id: string } } };

export type FinishRecoverPasswordMutationVariables = Exact<{
  newPassword: Scalars['String'];
  token: Scalars['String'];
}>;


export type FinishRecoverPasswordMutation = { __typename?: 'Mutation', user: { __typename?: 'UserMutation', finishRecoverPassword?: { __typename?: 'User', id: string } | null } };

export type StartRecoverPasswordMutationVariables = Exact<{
  email: Scalars['String'];
  recoverUrl: Scalars['String'];
}>;


export type StartRecoverPasswordMutation = { __typename?: 'Mutation', user: { __typename?: 'UserMutation', startRecoverPassword?: boolean | null } };

export type SearchPageGamesQueryVariables = Exact<{
  query: Scalars['String'];
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type SearchPageGamesQuery = { __typename?: 'Query', games: { __typename?: 'GamesQuery', byQueryWithTotal: { __typename?: 'GamesPaged', totalAmount: number, games: Array<{ __typename?: 'Game', id: string, name?: string | null, year?: number | null, amountOfComments: number, amountOfRatings: number, averageRating: number, totalRating: number, labels: Array<{ __typename?: 'Label', id: string, name?: string | null }> }> } } };

export type SearchPageUsersQueryVariables = Exact<{
  query: Scalars['String'];
  offset: Scalars['Int'];
  limit: Scalars['Int'];
}>;


export type SearchPageUsersQuery = { __typename?: 'Query', usersByQuery: Array<{ __typename?: 'User', id: string, name: string, nickname?: string | null, birthDate?: string | null, city?: string | null, image?: { __typename?: 'Image', id: string } | null }> };

export type LogInMutationVariables = Exact<{
  userName: Scalars['String'];
  password: Scalars['String'];
}>;


export type LogInMutation = { __typename?: 'Mutation', user: { __typename?: 'UserMutation', logIn?: { __typename?: 'User', id: string } | null } };

export type StartEmailLoginMutationVariables = Exact<{
  email: Scalars['String'];
  loginUrlTemplate: Scalars['String'];
}>;


export type StartEmailLoginMutation = { __typename?: 'Mutation', user: { __typename?: 'UserMutation', startEmailLogin: boolean } };

export type CreateUserMutationVariables = Exact<{
  input: CreateUserInput;
}>;


export type CreateUserMutation = { __typename?: 'Mutation', user: { __typename?: 'UserMutation', createUser?: { __typename?: 'User', id: string } | null } };

export type GetConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type GetConfigQuery = { __typename?: 'Query', config: { __typename?: 'Config', reCaptchaKey: string } };

export type SearchGamesQueryVariables = Exact<{
  query: Scalars['String'];
  limit: Scalars['Int'];
}>;


export type SearchGamesQuery = { __typename?: 'Query', games: { __typename?: 'GamesQuery', byQuery: Array<{ __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number }> } };

export type SignOutMutationVariables = Exact<{ [key: string]: never; }>;


export type SignOutMutation = { __typename?: 'Mutation', user: { __typename?: 'UserMutation', logOut?: { __typename?: 'User', id: string } | null } };

export type SetCommentVisibleMutationVariables = Exact<{
  commentId: Scalars['ID'];
  visible: Scalars['Boolean'];
}>;


export type SetCommentVisibleMutation = { __typename?: 'Mutation', game: { __typename?: 'GameMutation', setCommentVisible: { __typename?: 'Game', id: string } } };

export type LoggedInUserQueryVariables = Exact<{ [key: string]: never; }>;


export type LoggedInUserQuery = { __typename?: 'Query', loggedInUser?: { __typename?: 'User', id: string, role?: UserRole | null, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string } | null } | null };

export type AuthorizedLabelsFragment = { __typename?: 'Query', authorizedRequiredLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null }>, authorizedOptionalLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null }> };

export type BaseGameDataFragment = { __typename?: 'Game', id: string, name?: string | null, players?: number | null, averageRating: number, amountOfComments: number, amountOfRatings: number };

export type GameDetailCommentFragment = { __typename?: 'Comment', id: string, added?: string | null, amountOfUpvotes: number, comment?: string | null, isHidden?: boolean | null, user: { __typename?: 'User', id: string, name: string, nickname?: string | null, image?: { __typename?: 'Image', id: string } | null } };

export type LadderGameDataFragment = { __typename?: 'Game', id: string, name?: string | null, year?: number | null, amountOfComments: number, amountOfRatings: number, averageRating: number, totalRating: number, labels: Array<{ __typename?: 'Label', id: string, name?: string | null }> };

export type CheckEmailQueryVariables = Exact<{
  email: Scalars['String'];
}>;


export type CheckEmailQuery = { __typename?: 'Query', userByEmail?: { __typename?: 'User', id: string, email?: string | null, name: string, nickname?: string | null } | null };

export type LoadLabelsQueryVariables = Exact<{ [key: string]: never; }>;


export type LoadLabelsQuery = { __typename?: 'Query', authorizedRequiredLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null }>, authorizedOptionalLabels: Array<{ __typename?: 'Label', id: string, name?: string | null, description?: string | null }> };
