/**
 * Unit tests for the mapper edge cases that integration suites pass by:
 * normalizeGame's photo/similarGames/ratingStats branches, and the
 * gamePermissions fallback when a game row arrived without its author
 * links loaded.
 */
import { describe, it, expect } from '@jest/globals';
import { normalizeGame, normalizeUserRef } from '../resolvers/mappers';
import { isGameAuthor } from '../resolvers/gamePermissions';

describe('normalizeGame edge branches', () => {
  it('maps photos with full dimensions and their nested game', () => {
    const game = normalizeGame({
      id: 1,
      name: 'G',
      csld_photo_csld_photo_gameTocsld_game: [
        { fullwidth: 100, fullheight: 50, csld_image: { id: 7 }, csld_game_csld_photo_gameTocsld_game: { id: 2, name: 'Nested' } },
      ],
    });
    expect(game.photos).toHaveLength(1);
    expect(game.photos[0].fullWidth).toBe(100);
    expect(game.photos[0].fullHeight).toBe(50);
    expect(game.photos[0].image.id).toBe(7);
    expect(game.photos[0].game.id).toBe(2);
  });

  it('drops soft-deleted games from similarGames and normalizes the rest', () => {
    const game = normalizeGame({
      id: 1,
      name: 'G',
      similar_games_similar_games_id_game1Tocsld_game: [
        { csld_game_similar_games_id_game2Tocsld_game: { id: 2, name: 'Alive', deleted: false } },
        { csld_game_similar_games_id_game2Tocsld_game: { id: 3, name: 'Gone', deleted: true } },
        { csld_game_similar_games_id_game2Tocsld_game: null },
      ],
    });
    expect(game.similarGames.map((g: { id: number }) => g.id)).toEqual([2]);
  });

  it('aggregates ratingStats over numeric ratings only', () => {
    const game = normalizeGame({
      id: 1,
      name: 'G',
      csld_rating: [{ rating: 4 }, { rating: 4 }, { rating: null }, { rating: 5 }],
    });
    expect(game.ratingStats).toEqual([
      { rating: 4, count: 2 },
      { rating: 5, count: 1 },
    ]);
  });

  it('keeps nullability of the video/image columns', () => {
    const game = normalizeGame({ id: 1, name: 'G', csld_video: null });
    expect(game.video).toBeNull();
    expect(game.coverImage).toBeNull();
    expect(game.image).toBeNull();
  });
});

describe('normalizeUserRef', () => {
  it('maps the role enum, the gender and the image', () => {
    const user = normalizeUserRef({
      id: 1,
      role: 1,
      gender: 2,
      csld_image: { id: 9, path: 'img/9.png' },
    });
    expect(user.role).toBe('USER');
    expect(user.gender).toEqual(expect.anything());
    expect(user.image.id).toBe(9);
  });

  it('returns null for a null row and null image/role', () => {
    expect(normalizeUserRef(null)).toBeNull();
    const user = normalizeUserRef({ id: 1, role: null, csld_image: null });
    expect(user.role).toBe('USER'); // normalizeUserRole maps null to USER
    expect(user.image).toBeNull();
  });
});

describe('isGameAuthor fallback', () => {
  const ctx = (id: number) => ({ user: { id }, db: null } as never);

  it('uses the loaded links when they are present', async () => {
    const game = { id: '1', csld_game_has_author: [{ id_user: 7 }] };
    expect(await isGameAuthor(game as never, ctx(7))).toBe(true);
    expect(await isGameAuthor(game as never, ctx(8))).toBe(false);
  });

  it('ignores non-numeric author ids', async () => {
    const game = { id: '1', csld_game_has_author: [{ id_user: 'abc' }, { id_user: null }] };
    expect(await isGameAuthor(game as never, ctx(7))).toBe(false);
  });

  it('returns false without a user or game', async () => {
    expect(await isGameAuthor({ id: 1 }, { user: null } as never)).toBe(false);
    expect(await isGameAuthor(null, ctx(1))).toBe(false);
  });

  it('asks the database when the game has no author links loaded', async () => {
    const game = { id: 42 }; // no csld_game_has_author array -> fallback
    // ctx.db is null: the fallback would throw, so wrap it
    await expect(isGameAuthor(game as never, ctx(7))).rejects.toBeTruthy();
  });
});
