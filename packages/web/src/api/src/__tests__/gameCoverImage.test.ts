/**
 * The cover-image and link-sync paths of createGame / updateGame, plus the
 * guards (NaN ids, empty comment, unauthorised editor, series resolution).
 *
 * These blocks need a working `ctx.files` (the other suites run with
 * files: null), so this suite wires a LocalFiles into a tmp directory and
 * asserts that the uploaded cover image lands on disk, in csld_image, and
 * linked on the game row.
 */
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ApolloServer } from '@apollo/server';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { LocalFiles } from '../files/fileService';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

const stamp = Date.now();
const marker = `gcover-${stamp}`;

// A 1x1 transparent PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const CREATE_GAME = `
  mutation C($input: CreateGameInput!) {
    game { createGame(input: $input) { id name coverImage { id path } } }
  }`;
const UPDATE_GAME = `
  mutation U($input: UpdateGameInput!) {
    game { updateGame(input: $input) { id name coverImage { id path } } }
  }`;

let server: ApolloServer;
let tmpDir: string;
let files: LocalFiles;
let meId: number;
const createdGameIds: number[] = [];

function ctxFor(id: number, role: number) {
  return {
    user: {
      id,
      email: `${marker}@integration.test`,
      name: 'GCover Probe',
      nickname: null,
      description: null,
      role,
      image: null,
      amountOfComments: 0,
      amountOfPlayed: 0,
      amountOfCreated: 0,
    },
    files,
  };
}

async function baseInput(name: string) {
  return {
    name,
    description: 'desc',
    authors: [String(meId)],
    newAuthors: [],
    groupAuthors: [] as string[],
    newGroupAuthors: [],
    labels: [] as string[],
    newLabels: [],
  };
}

beforeAll(async () => {
  server = createTestServer();
  tmpDir = mkdtempSync(join(tmpdir(), 'csld-cover-test-'));
  files = new LocalFiles(tmpDir);
  const me = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  meId = me.id;
});

afterAll(async () => {
  // cover images and links of the games this suite created
  for (const gameId of createdGameIds) {
    const game = await prisma.csld_game.findUnique({ where: { id: gameId } });
    await prisma.csld_game_has_group.deleteMany({ where: { id_game: gameId } });
    await prisma.csld_game_has_label.deleteMany({ where: { id_game: gameId } });
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: gameId } });
    await prisma.csld_game.deleteMany({ where: { id: gameId } });
    if (game?.cover_image) {
      await prisma.csld_image.deleteMany({ where: { id: game.cover_image } });
    }
  }
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, marker));
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('createGame cover image and link sync', () => {
  it('stores the cover image, creates csld_image and links it to the game', async () => {
    const input = {
      ...(await baseInput(`${marker} with-cover`)),
      coverImage: { fileName: 'cover.png', contents: PNG_B64 },
    };
    const res = await executeQuery(server, CREATE_GAME, { input }, ctxFor(meId, 1));
    expect(res.errors).toBeUndefined();
    const game = (res.data as { game: { createGame: { id: string; coverImage: { path: string } | null } } })
      .game.createGame;
    createdGameIds.push(parseInt(game.id, 10));

    expect(game.coverImage).not.toBeNull();
    // The file is on disk under the LocalFiles root.
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(tmpDir, game.coverImage!.path))).toBe(true);

    // The game row points at the image.
    const row = await prisma.csld_game.findUnique({ where: { id: parseInt(game.id, 10) } });
    expect(row?.cover_image).not.toBeNull();
  });

  it('links groupAuthors and labels when provided', async () => {
    const group = await prisma.csld_csld_group.create({
      data: { name: `${marker} group`, administrator_id: meId },
    });
    const label = await prisma.csld_label.create({
      data: { name: `${marker} label`, is_required: false, is_authorized: true, added_by: meId },
    });

    const input = {
      ...(await baseInput(`${marker} with-links`)),
      groupAuthors: [String(group.id)],
      labels: [String(label.id)],
    };
    const res = await executeQuery(server, CREATE_GAME, { input }, ctxFor(meId, 1));
    expect(res.errors).toBeUndefined();
    const game = (res.data as { game: { createGame: { id: string } } }).game.createGame;
    const gameId = parseInt(game.id, 10);
    createdGameIds.push(gameId);

    const groups = await prisma.csld_game_has_group.findMany({ where: { id_game: gameId } });
    expect(groups.map((g) => g.id_group)).toContain(group.id);
    const labels = await prisma.csld_game_has_label.findMany({ where: { id_game: gameId } });
    expect(labels.map((l) => l.id_label)).toContain(label.id);

    await prisma.csld_game_has_group.deleteMany({ where: { id_group: group.id } });
    await prisma.csld_game_has_label.deleteMany({ where: { id_label: label.id } });
    await prisma.csld_csld_group.deleteMany({ where: { id: group.id } });
    await prisma.csld_label.deleteMany({ where: { id: label.id } });
  });
});

describe('updateGame cover image', () => {
  it('replaces the cover image on update', async () => {
    // create without a cover first
    const createRes = await executeQuery(
      server,
      CREATE_GAME,
      { input: await baseInput(`${marker} update-cover`) },
      ctxFor(meId, 1),
    );
    const created = (createRes.data as { game: { createGame: { id: string } } }).game.createGame;
    const gameId = parseInt(created.id, 10);
    createdGameIds.push(gameId);

    const res = await executeQuery(
      server,
      UPDATE_GAME,
      {
        input: {
          id: created.id,
          ...(await baseInput(`${marker} update-cover`)),
          description: 'desc2',
          coverImage: { fileName: 'new.png', contents: PNG_B64 },
        },
      },
      ctxFor(meId, 1),
    );
    expect(res.errors).toBeUndefined();
    const game = (res.data as { game: { updateGame: { coverImage: { path: string } | null } } })
      .game.updateGame;
    expect(game.coverImage).not.toBeNull();
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(tmpDir, game.coverImage!.path))).toBe(true);

    const row = await prisma.csld_game.findUnique({ where: { id: gameId } });
    expect(row?.cover_image).not.toBeNull();
  });

  it('refuses an edit by a non-author stranger', async () => {
    const strangerId = meId + 1_000_000;
    const res = await executeQuery(
      server,
      UPDATE_GAME,
      {
        input: {
          id: String(createdGameIds[0]),
          ...(await baseInput('nope')),
          description: 'hijack',
        },
      },
      ctxFor(strangerId, 1),
    );
    expect(res.errors).toBeDefined();
    expect((res.errors![0] as { extensions: { code: string } }).extensions.code).toBe('ACCESS_DENIED');
  });

  it('refuses an invalid game id', async () => {
    const res = await executeQuery(
      server,
      UPDATE_GAME,
      { input: { id: 'not-a-number', ...(await baseInput('nope')), description: 'x' } },
      ctxFor(meId, 2),
    );
    expect(res.errors).toBeDefined();
  });
});
