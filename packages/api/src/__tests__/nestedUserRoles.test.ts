import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * A `csld_csld_user` row reached through another type — a game author, the
 * author of a comment or of a rating — used to be served raw, and a raw row is
 * not a `User`:
 *
 *   * `role` is a number in the database (0 ANONYMOUS … 4 AUTHOR) while the
 *     field is the `UserRole` enum of names → `Enum "UserRole" cannot represent
 *     value: 1`;
 *   * `image` is the scalar foreign key while the schema declares an `Image`
 *     → `Cannot return null for non-nullable field Image.id`.
 *
 * Both were reproduced against production before the fix:
 * `gameById(authors{role})`, `gameById(comments{user{role}})`,
 * `gameById(comments{user{image{id}}})`, `gameById(ratings{user{role}})`,
 * `gameById(authors{image{id}})` and `homepage(lastComments{user{role}})` all
 * answered with errors, one per row, while the same queries without `role` and
 * `image` answered fine. The fields the app itself asks for are exactly these
 * (`graphql/fragments/gameDetailComment.graphql` reads `user { image { id } }`).
 */
describe('a nested user is served as a User, not as a raw row', () => {
  let server: ApolloServer;
  const marker = `NestedUser${Date.now()}`;

  let authorId: number;
  let editorId: number;
  let imageId: number;
  let gameId: number;
  let commentId: number;
  let ratingId: number;

  beforeAll(async () => {
    server = createTestServer();

    const image = await prisma.csld_image.create({ data: { path: `${marker}/photo.jpg` } });
    imageId = image.id;

    const author = await prisma.csld_csld_user.create({
      data: {
        password: 'x',
        role: 1, // USER
        name: `${marker} autor`,
        email: `${marker}-author@integration.test`,
        image: imageId,
      },
    });
    authorId = author.id;

    const editor = await prisma.csld_csld_user.create({
      data: { password: 'x', role: 2, name: `${marker} editor`, email: `${marker}-editor@integration.test` },
    });
    editorId = editor.id;

    const game = await prisma.csld_game.create({
      data: { name: `${marker} hra`, description: 'x', deleted: false, added_by: editorId },
    });
    gameId = game.id;
    await prisma.csld_game_has_author.create({ data: { id_game: gameId, id_user: editorId } });

    const comment = await prisma.csld_comment.create({
      data: { game_id: gameId, user_id: authorId, comment: 'Komentář', is_hidden: false, amount_of_upvotes: 0 },
    });
    commentId = comment.id;

    const rating = await prisma.csld_rating.create({
      data: { game_id: gameId, user_id: authorId, rating: 8, state: 2 },
    });
    ratingId = rating.id;
  });

  afterAll(async () => {
    await prisma.csld_comment.deleteMany({ where: { id: commentId } });
    await prisma.csld_rating.deleteMany({ where: { id: ratingId } });
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: gameId } });
    await prisma.csld_game.deleteMany({ where: { id: gameId } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: [authorId, editorId] } } });
    await prisma.csld_image.deleteMany({ where: { id: imageId } });
    await prisma.$disconnect();
  });

  test('game authors carry a role name and their photo', async () => {
    const result = await executeQuery(
      server,
      `query ($id: ID!) { gameById(gameId: $id) { authors { id name role image { id path } } } }`,
      { id: String(gameId) },
    );

    expect(result.errors).toBeUndefined();
    const authors = (result.data as any).gameById.authors;
    expect(authors).toHaveLength(1);
    expect(authors[0].id).toBe(String(editorId));
    expect(authors[0].role).toBe('EDITOR');
    expect(authors[0].image).toBeNull();
  });

  test('a comment author carries a role name and their photo', async () => {
    const result = await executeQuery(
      server,
      `query ($id: ID!) { gameById(gameId: $id) { comments { id user { id name role image { id path } } } } }`,
      { id: String(gameId) },
    );

    expect(result.errors).toBeUndefined();
    const comments = (result.data as any).gameById.comments;
    expect(comments).toHaveLength(1);
    expect(comments[0].user.role).toBe('USER');
    expect(comments[0].user.image).toEqual({ id: String(imageId), path: `${marker}/photo.jpg` });
  });

  test('a rating author carries a role name', async () => {
    const result = await executeQuery(
      server,
      `query ($id: ID!) { gameById(gameId: $id) { ratings { id user { id role } } } }`,
      { id: String(gameId) },
    );

    expect(result.errors).toBeUndefined();
    const ratings = (result.data as any).gameById.ratings;
    expect(ratings).toHaveLength(1);
    expect(ratings[0].user.role).toBe('USER');
  });

  test('the homepage last comments carry role names too', async () => {
    const result = await executeQuery(
      server,
      `{ homepage { lastComments(offset: 0, limit: 50) { id user { id role image { id } } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const comments = (result.data as any).homepage.lastComments;
    const ours = comments.find((c: any) => c.id === String(commentId));
    expect(ours).toBeDefined();
    expect(ours.user.role).toBe('USER');
    expect(ours.user.image).toEqual({ id: String(imageId) });
    // Every row, not just ours: a raw row would have failed the query above.
    comments.forEach((c: any) => {
      expect(c.user.role).toMatch(/^(ANONYMOUS|USER|EDITOR|ADMIN|AUTHOR)$/);
    });
  });

  test('a user reached directly is normalized the same way', async () => {
    const result = await executeQuery(
      server,
      `query ($id: ID!) { userById(userId: $id) { id role image { id } } }`,
      { id: String(authorId) },
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).userById.role).toBe('USER');
    expect((result.data as any).userById.image).toEqual({ id: String(imageId) });
  });
});
