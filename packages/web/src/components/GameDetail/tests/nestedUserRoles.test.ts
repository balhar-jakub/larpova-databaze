import { normalizeGame, normalizeUserRef, normalizeUserRole } from '../../../api/src/resolvers/mappers';
import { resolvers } from '../../../api/src/resolvers/index';

/**
 * The same bug as `src/api/src/__tests__/nestedUserRoles.test.ts`, checked
 * against the copy the server really loads (`server.ts` imports
 * `./src/api/src/...`): a `csld_csld_user` row reached through another type — a
 * game author, the author of a comment or of a rating — used to be served raw,
 * and a raw row is not a `User`:
 *
 *   * `role` is a number in the database (0 ANONYMOUS … 4 AUTHOR) while the
 *     field is the `UserRole` enum of names → `Enum "UserRole" cannot represent
 *     value: 1`;
 *   * `image` is the scalar foreign key while the schema declares an `Image`
 *     → `Cannot return null for non-nullable field Image.id`.
 *
 * Reproduced against production before the fix: `gameById(authors{role})`,
 * `gameById(comments{user{role}})`, `gameById(authors{image{id}})`,
 * `gameById(ratings{user{role}})`, `gameById(comments{user{image{id}}})` and
 * `homepage(lastComments{user{role}})` each answered with one error per row.
 *
 * No database here: the web jest environment cannot load the Prisma client, so
 * the resolvers are driven with a hand-written fake (see the sibling
 * `gameAuthorPermissions.test.ts`).
 */

const USER = 1;
const EDITOR = 2;

/** A raw `csld_csld_user` row as Prisma returns it under another type. */
function userRow(id: number, role: number, imageId?: number) {
  return {
    id,
    role,
    name: `User ${id}`,
    nickname: null,
    email: `user-${id}@integration.test`,
    image: imageId ?? null,
    csld_image: imageId ? { id: imageId, path: `users/${id}.jpg`, contenttype: 'image/jpeg' } : undefined,
  };
}

describe('normalizeUserRole', () => {
  test('maps the database numbers to the enum names', () => {
    expect(normalizeUserRole(0)).toBe('ANONYMOUS');
    expect(normalizeUserRole(1)).toBe('USER');
    expect(normalizeUserRole(2)).toBe('EDITOR');
    expect(normalizeUserRole(3)).toBe('ADMIN');
    expect(normalizeUserRole(4)).toBe('AUTHOR');
  });

  test('falls back to USER for a missing or unknown number', () => {
    expect(normalizeUserRole(null)).toBe('USER');
    expect(normalizeUserRole(undefined)).toBe('USER');
    expect(normalizeUserRole(99)).toBe('USER');
  });
});

describe('normalizeUserRef', () => {
  test('a raw row becomes a User: role name, snapshot of the photo, no scalar image', () => {
    const user = normalizeUserRef(userRow(42, EDITOR, 7));

    expect(user.role).toBe('EDITOR');
    expect(user.image).toEqual({ id: 7, path: 'users/42.jpg', contenttype: 'image/jpeg' });
    expect(user.name).toBe('User 42');
  });

  test('without a loaded photo the image is null, never the foreign key', () => {
    const user = normalizeUserRef(userRow(42, USER));

    expect(user.role).toBe('USER');
    expect(user.image).toBeNull();
  });

  test('a missing row stays null', () => {
    expect(normalizeUserRef(null)).toBeNull();
    expect(normalizeUserRef(undefined)).toBeNull();
  });
});

describe('normalizeGame normalizes every nested user', () => {
  const game = normalizeGame({
    id: 7,
    name: 'Hra',
    deleted: false,
    csld_game_has_author: [{ id_user: 42, csld_csld_user: userRow(42, EDITOR) }],
    csld_comment: [{ id: 1, comment: 'Ahoj', csld_csld_user: userRow(43, USER, 9) }],
    csld_rating: [{ id: 2, rating: 8, state: 2, csld_csld_user: userRow(43, USER, 9) }],
  }) as any;

  test('authors, comment authors and rating authors all carry enum roles', () => {
    expect(game.authors.map((a: any) => a.role)).toEqual(['EDITOR']);
    expect(game.comments.map((c: any) => c.user.role)).toEqual(['USER']);
    expect(game.ratings.map((r: any) => r.user.role)).toEqual(['USER']);
  });

  test('no nested user leaks a numeric role or a scalar image', () => {
    const users = [...game.authors, ...game.comments.map((c: any) => c.user), ...game.ratings.map((r: any) => r.user)];

    users.forEach((user: any) => {
      expect(typeof user.role).toBe('string');
      expect(user.image === null || typeof user.image === 'object').toBe(true);
    });
  });

  test('a nested user keeps the photo the caller included', () => {
    expect(game.comments[0].user.image).toEqual({ id: 9, path: 'users/43.jpg', contenttype: 'image/jpeg' });
  });
});

describe('the deployed HomepageQuery.lastComments resolver', () => {
  test('serves its comment authors as Users', async () => {
    const rows = [
      {
        id: 11,
        comment: 'Ahoj <b>světe</b>',
        amount_of_upvotes: 0,
        is_hidden: false,
        csld_csld_user: userRow(43, USER, 9),
        csld_game: null,
      },
    ];
    const ctx: any = {
      db: {
        csld_comment: { findMany: async () => rows },
      },
      user: null,
    };

    const comments = await resolvers.HomepageQuery.lastComments({}, { limit: 6 }, ctx);

    expect(comments).toHaveLength(1);
    expect(comments[0].commentAsText).toBe('Ahoj světe');
    expect(comments[0].user.role).toBe('USER');
    expect(comments[0].user.image).toEqual({ id: 9, path: 'users/43.jpg', contenttype: 'image/jpeg' });
  });
});
