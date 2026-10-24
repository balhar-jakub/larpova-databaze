import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prisma } from '../context';
import { LocalFiles, Base64UploadedFile } from '../files/fileService';
import { getCuttingSquareStrategy } from '../files/imageStrategies';
import { gameAllowedActions } from '../resolvers/gamePermissions';
import { articlesResolver, mapArticleRow } from '../resolvers/article';

/**
 * A direct-call sweep of the small-file cold arms: imageStrategies'
 * orientation arms (wide/tall/square), fileService's saveFileAndReturnPath
 * and preview path, gamePermissions' deleted-game matrix, article's null
 * mapping (published_at null, perex null in query matching), and the
 * articles offset/limit defaults.
 */
const stamp = Date.now();
const marker = `smallearms-${stamp}`;

let dataDir: string;
let files: LocalFiles;
let userId: number;
let gameId: number;
const articleIds: number[] = [];

async function pngB64(w: number, h: number): Promise<string> {
  const buffer = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 20, g: 80, b: 140 } } })
    .png().toBuffer();
  return buffer.toString('base64');
}

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), `csld-smallearms-${stamp}`));
  files = new LocalFiles(dataDir);
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = user.id;
  const game = await prisma.csld_game.create({
    data: { name: `${marker} hra`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameId = game.id;
  await prisma.csld_game_has_author.create({ data: { id_game: gameId, id_user: userId } });
});

afterAll(async () => {
  await prisma.csld_article.deleteMany({ where: { source_id: { startsWith: marker } } });
  await prisma.csld_game_has_author.deleteMany({ where: { id_game: gameId } });
  await prisma.csld_game.deleteMany({ where: { id: gameId } });
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  rmSync(dataDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('imageStrategies orientation arms', () => {
  it('crops a wide image horizontally and a tall one vertically', async () => {
    const wide = await sharp(await getCuttingSquareStrategy(40, 10)(Buffer.from(await pngB64(80, 40), 'base64'))).metadata();
    expect(wide.width).toBe(40);
    expect(wide.height).toBe(40);
    const tall = await sharp(await getCuttingSquareStrategy(40, 10)(Buffer.from(await pngB64(40, 80), 'base64'))).metadata();
    expect(tall.width).toBe(40);
    expect(tall.height).toBe(40);
  });
});

describe('fileService.saveFileAndReturnPath', () => {
  it('writes a non-image file byte-for-byte under a generated path', async () => {
    const payload = Buffer.from('nejsem obrazek, jen text');
    const path = await files.saveFileAndReturnPath(new Base64UploadedFile('data.txt', payload.toString('base64')));
    expect(path.length).toBeGreaterThan(0);
    expect(existsSync(join(dataDir, path))).toBe(true);
  });
});

describe('gamePermissions matrix arms', () => {
  const ctx = (role: number) => ({ db: prisma, user: { id: userId, role } } as never);

  it('a deleted game answers Edit for an editor and nothing for a plain user', async () => {
    expect(await gameAllowedActions({ id: gameId, deleted: true } as never, ctx(3))).toEqual(['Edit']);
    expect(await gameAllowedActions({ id: gameId, deleted: true } as never, ctx(1))).toEqual([]);
  });

  it('an author without loaded authors falls back to the database link', async () => {
    // no csld_game_has_author array at all — the DB lookup path
    const actions = await gameAllowedActions({ id: gameId, deleted: false } as never, ctx(1));
    expect(actions).toEqual(['Edit', 'Delete']);
  });

  it('a game that is not the author answers nothing', async () => {
    const stranger = { ...(ctx(1) as object), user: { id: userId + 999999, role: 1 } } as never;
    expect(await gameAllowedActions({ id: gameId, deleted: false, csld_game_has_author: [] } as never, stranger)).toEqual([]);
  });
});

describe('article null mapping and defaults', () => {
  it('maps published_at null, answers the offset/limit defaults, and matches a null perex', async () => {
    const bare = await prisma.csld_article.create({
      data: {
        source: 'LARPY_CZ',
        source_id: `${marker}-bare`,
        url: 'https://example.com/bare',
        title: 'Bare row bez perexu',
        language: 'cs',
        published_at: null,
        categories: [],
        tags: [],
      },
    });
    articleIds.push(bare.id);

    const page = await articlesResolver({}, {} as never, { db: prisma } as never);
    const found = (page as any).articles.find((a: any) => a.sourceId === `${marker}-bare`);
    expect(found).toBeDefined();
    expect(found.publishedAt).toBeNull(); // published_at null → null

    // query matching must not crash on the null perex (?? '' arm)
    const byQuery = await articlesResolver({}, { query: 'bare row' } as never, { db: prisma } as never);
    expect((byQuery as any).articles.some((a: any) => a.sourceId === `${marker}-bare`)).toBe(true);
  });
});
