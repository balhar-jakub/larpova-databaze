import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * Label.isRequired / Label.isAuthorized reach GraphQL from raw csld_label rows
 * (a game's labels, the admin label list, the authorized catalogues), where the
 * columns are snake_case. The game edit form reads the flags to split the game's
 * labels into the mandatory and the optional group, and its validator refuses to
 * save a game whose mandatory group came out empty — so a missing field resolver
 * here means no game can be saved through the form at all, while every jest suite
 * that never selects the field stays green.
 */

const GAME_LABELS_QUERY = `
  query ($id: ID!) {
    gameById(gameId: $id) {
      id
      labels { id name isRequired isAuthorized }
    }
  }
`;

type LabelRow = { id: string; name: string | null; isRequired: boolean | null; isAuthorized: boolean | null };

describe('a game\'s labels carry their required and authorized flags', () => {
  const marker = `LabelTest${Date.now()}`;
  let server: ApolloServer;

  let userId: number;
  let gameId: number;
  let requiredLabelId: number;
  let optionalLabelId: number;

  const gameLabels = async () => {
    const res: any = await executeQuery(server, GAME_LABELS_QUERY, { id: String(gameId) });
    expect(res.errors).toBeUndefined();
    return res.data.gameById.labels as LabelRow[];
  };

  beforeAll(async () => {
    server = createTestServer();

    // A failed beforeAll skips afterAll, so the suite's own leftovers from an
    // earlier run are swept first — otherwise every later run works on residue.
    const staleGames = await prisma.csld_game.findMany({
      where: { name: { startsWith: 'LabelTest' } },
      select: { id: true },
    });
    await prisma.csld_game_has_label.deleteMany({ where: { id_game: { in: staleGames.map((g) => g.id) } } });
    await prisma.csld_game.deleteMany({ where: { name: { startsWith: 'LabelTest' } } });
    await prisma.csld_label.deleteMany({ where: { name: { startsWith: 'LabelTest' } } });
    await prisma.csld_csld_user.deleteMany({ where: { email: { startsWith: 'LabelTest' } } });

    const user = await prisma.csld_csld_user.create({
      data: { password: 'x', role: 1, name: `${marker} uživatel`, email: `${marker}@integration.test` },
    });
    userId = user.id;

    const game = await prisma.csld_game.create({
      data: { name: `${marker} hra`, year: 2019, deleted: false },
    });
    gameId = game.id;

    const required = await prisma.csld_label.create({
      data: { name: `${marker} povinný`, is_required: true, is_authorized: true, added_by: userId },
    });
    requiredLabelId = required.id;

    const optional = await prisma.csld_label.create({
      data: { name: `${marker} volitelný`, is_required: false, is_authorized: true, added_by: userId },
    });
    optionalLabelId = optional.id;

    for (const id of [requiredLabelId, optionalLabelId]) {
      await prisma.csld_game_has_label.create({ data: { id_game: gameId, id_label: id } });
    }
  });

  afterAll(async () => {
    await prisma.csld_game_has_label.deleteMany({ where: { id_game: gameId } });
    await prisma.csld_game.deleteMany({ where: { id: gameId } });
    await prisma.csld_label.deleteMany({ where: { id: { in: [requiredLabelId, optionalLabelId] } } });
    await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  });

  it('answers true for the required label and false for the optional one', async () => {
    const labels = await gameLabels();
    expect(labels.find((l) => l.id === String(requiredLabelId))?.isRequired).toBe(true);
    expect(labels.find((l) => l.id === String(optionalLabelId))?.isRequired).toBe(false);
  });

  it('hands the edit form a non-empty list of required labels', async () => {
    // GameEditPagePanel does exactly this, and the form's validator then refuses
    // to save the game when the list is empty.
    const labels = await gameLabels();
    const requiredLabels = labels.filter((l) => l.isRequired).map((l) => l.id);
    expect(requiredLabels).toEqual([String(requiredLabelId)]);
  });

  it('answers isAuthorized instead of null for an authorized label', async () => {
    const labels = await gameLabels();
    expect(labels.find((l) => l.id === String(requiredLabelId))?.isAuthorized).toBe(true);
  });

  it('serves the same flags for a label that is not required', async () => {
    const labels = await gameLabels();
    const optional = labels.find((l) => l.id === String(optionalLabelId));
    expect(optional?.isAuthorized).toBe(true);
    expect(optional?.name).toBe(`${marker} volitelný`);
  });
});
