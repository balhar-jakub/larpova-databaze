import { normalizeUser } from '../resolvers/user';

/**
 * The profile overview lists a user's games by their play state
 * (`csld_rating.state`): 2 = "Hrál jsem", 1 = "Chci hrát". Every rating row
 * used to be listed as played, so games the user only wants to play showed up
 * under "Hrál jsem" while "Chci hrát" stayed empty.
 */

function game(id: number, name: string) {
  return {
    id,
    name,
    year: 2011,
    deleted: false,
    total_rating: 60,
    average_rating: 60,
    amount_of_ratings: 3,
    amount_of_comments: 0,
    amount_of_played: 2,
    csld_game_has_label: [],
    csld_game_has_author: [],
    csld_comment: [],
    csld_rating: [],
  };
}

function userRow(ratings: any[]) {
  return {
    id: 42,
    role: 1,
    name: 'Test User',
    nickname: null,
    email: 'test@example.com',
    birth_date: null,
    address: null,
    image: null,
    csld_image: null,
    amount_of_comments: 0,
    amount_of_played: 999,
    amount_of_created: 0,
    last_rating: null,
    csld_rating: ratings,
    csld_game_has_author: [],
    csld_comment: [],
  };
}

const PLAYED = 2;
const WANT_TO_PLAY = 1;
const NONE = 0;

describe('profile game lists follow the play state', () => {
  test('played games hold only state=2 rows', () => {
    const user = normalizeUser(
      userRow([
        { game_id: 1, user_id: 42, rating: 7, state: PLAYED, csld_game: game(1, 'Played') },
        { game_id: 2, user_id: 42, rating: null, state: WANT_TO_PLAY, csld_game: game(2, 'Wanted') },
      ]),
    ) as any;

    expect(user.playedGames.map((pg: any) => pg.game.name)).toEqual(['Played']);
    expect(user.playedGames[0].rating).toBe(7);
  });

  test('want-to-play games are not listed as played', () => {
    const user = normalizeUser(
      userRow([
        { game_id: 2, user_id: 42, rating: null, state: WANT_TO_PLAY, csld_game: game(2, 'Wanted') },
        { game_id: 5, user_id: 42, rating: null, state: WANT_TO_PLAY, csld_game: game(5, 'Wanted 2') },
      ]),
    ) as any;

    expect(user.playedGames).toHaveLength(0);
    expect(user.wantedGames.map((g: any) => g.name)).toEqual(['Wanted', 'Wanted 2']);
  });

  test('a rated row without a play state stays out of both lists', () => {
    const user = normalizeUser(
      userRow([
        { game_id: 3, user_id: 42, rating: 5, state: NONE, csld_game: game(3, 'Rated only') },
        { game_id: 4, user_id: 42, rating: 4, state: null, csld_game: game(4, 'Legacy null') },
        { game_id: 1, user_id: 42, rating: 7, state: PLAYED, csld_game: game(1, 'Played') },
      ]),
    ) as any;

    expect(user.playedGames.map((pg: any) => pg.game.name)).toEqual(['Played']);
    expect(user.wantedGames).toEqual([]);
  });

  test('amountOfPlayed counts the played rows, not the stale column', () => {
    const user = normalizeUser(
      userRow([
        { game_id: 1, user_id: 42, rating: 7, state: PLAYED, csld_game: game(1, 'Played') },
        { game_id: 6, user_id: 42, rating: 3, state: PLAYED, csld_game: game(6, 'Played 2') },
        { game_id: 2, user_id: 42, rating: null, state: WANT_TO_PLAY, csld_game: game(2, 'Wanted') },
      ]),
    ) as any;

    expect(user.amountOfPlayed).toBe(2);
  });

  test('amountOfPlayed falls back to the column when ratings are not loaded', () => {
    const row = userRow([]);
    delete (row as any).csld_rating;

    const user = normalizeUser(row) as any;

    expect(user.amountOfPlayed).toBe(999);
    expect(user.playedGames).toEqual([]);
    expect(user.wantedGames).toEqual([]);
  });
});
