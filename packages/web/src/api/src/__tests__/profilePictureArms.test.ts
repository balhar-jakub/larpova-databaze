import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Base64UploadedFile } from '../files/fileService';
import { getCuttingSquareStrategy } from '../files/imageStrategies';
import sharp from 'sharp';
import { prisma } from '../context';
import { LocalFiles } from '../files/fileService';
import {
  saveProfilePicture,
  removeProfilePictureIfUnused,
  MAX_PROFILE_PICTURE_BYTES,
} from '../resolvers/profilePicture';

/**
 * Direct-call validation and cleanup arms of resolvers/profilePicture.ts
 * that the GraphQL suite (profilePicture.test.ts) leaves cold: the guard
 * order of saveProfilePicture (null, missing name/contents, oversized
 * base64, empty decode), the content-type fallbacks, and every branch of
 * removeProfilePictureIfUnused (null id, still-shared image kept, orphan
 * row+file removed, the error path that must not fail a replacement).
 */
const stamp = Date.now();
const marker = `ppedge-${stamp}`;

let dataDir: string;
let files: LocalFiles;
let ownerId: number;

const ctx = (user?: { id: number }) => ({ db: prisma, files, user: user ?? null } as never);

async function pngB64(): Promise<string> {
  const buffer = await sharp({
    create: { width: 60, height: 60, channels: 3, background: { r: 9, g: 90, b: 170 } },
  }).png().toBuffer();
  return buffer.toString('base64');
}

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), `csld-ppedge-${stamp}`));
  files = new LocalFiles(dataDir);
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  ownerId = user.id;
});



afterAll(async () => {
  await prisma.csld_csld_user.deleteMany({ where: { id: ownerId } });
  await prisma.csld_image.deleteMany({ where: { id: { in: createdImageIds } } });
  rmSync(dataDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

const createdImageIds: number[] = [];

describe('saveProfilePicture guard order', () => {
  it('no picture at all answers null (the form saved without a new file)', async () => {
    expect(await saveProfilePicture(ctx(ownerId), null)).toBeNull();
    expect(await saveProfilePicture(ctx(ownerId), undefined)).toBeNull();
  });

  it('rejects a picture missing the file name or the contents', async () => {
    const contents = await pngB64();
    await expect(saveProfilePicture(ctx(ownerId), { fileName: '', contents })).rejects.toThrow(
      /missing the file name or contents/,
    );
    await expect(saveProfilePicture(ctx(ownerId), { fileName: 'x.png', contents: '' })).rejects.toThrow(
      /missing the file name or contents/,
    );
  });

  it('rejects an oversized base64 before it is ever decoded', async () => {
    const huge = 'A'.repeat(Math.ceil(MAX_PROFILE_PICTURE_BYTES * 1.4) + 1);
    await expect(saveProfilePicture(ctx(ownerId), { fileName: 'big.png', contents: huge })).rejects.toThrow(
      /too large/,
    );
  });

  it('rejects contents that decode to nothing', async () => {
    // '==' is truthy (passes the missing-contents guard) but decodes to 0 bytes.
    await expect(saveProfilePicture(ctx(ownerId), { fileName: 'empty.png', contents: '==' })).rejects.toThrow(
      /empty/,
    );
  });

  it('rejects when the file storage is not wired (ctx.files absent)', async () => {
    const noFilesCtx = { db: prisma, files: undefined, user: { id: ownerId } } as never;
    await expect(saveProfilePicture(noFilesCtx, { fileName: 'x.png', contents: await pngB64() })).rejects.toThrow(
      /File storage is not available/,
    );
  });

  it('stores a real picture and records the content type from the extension', async () => {
    const id = await saveProfilePicture(ctx(ownerId), { fileName: 'me.PNG', contents: await pngB64() });
    expect(id).not.toBeNull();
    createdImageIds.push(id!);
    const row = await prisma.csld_image.findUnique({ where: { id: id! } });
    expect(row!.contenttype).toBe('image/png'); // .PNG → png → image/png
  });

  it('falls back to octet-stream for an unknown extension', async () => {
    const id = await saveProfilePicture(ctx(ownerId), { fileName: 'me.xyz', contents: await pngB64() });
    expect(id).not.toBeNull();
    createdImageIds.push(id!);
    const row = await prisma.csld_image.findUnique({ where: { id: id! } });
    expect(row!.contenttype).toBe('application/octet-stream');
  });
});

describe('removeProfilePictureIfunused branches', () => {
  it('a null id is a no-op', async () => {
    await expect(removeProfilePictureIfUnused(ctx(ownerId), null)).resolves.toBeUndefined();
  });

  it('keeps an image other accounts still point at', async () => {
    const shared = await prisma.csld_image.create({
      data: { path: `upload/${marker}-shared.png`, contenttype: 'image/png' },
    });
    createdImageIds.push(shared.id);
    await prisma.csld_csld_user.update({ where: { id: ownerId }, data: { image: shared.id } });
    try {
      await removeProfilePictureIfUnused(ctx(ownerId), shared.id);
      expect(await prisma.csld_image.findUnique({ where: { id: shared.id } })).not.toBeNull();
    } finally {
      await prisma.csld_csld_user.update({ where: { id: ownerId }, data: { image: null } });
    }
  });

  it('removes an orphan: the row and the file on disk', async () => {
    const stored = await files.saveImageAndReturnPath(
      new Base64UploadedFile('orphan.png', await pngB64()),
      getCuttingSquareStrategy(120, 10),
    );
    const image = await prisma.csld_image.create({
      data: { path: stored.path, contenttype: 'image/png' },
    });
    createdImageIds.push(image.id);
    const fileExists = existsSync(join(dataDir, stored.path));
    expect(fileExists).toBe(true);
    await removeProfilePictureIfUnused(ctx(ownerId), image.id);
    expect(await prisma.csld_image.findUnique({ where: { id: image.id } })).toBeNull();
    expect(existsSync(join(dataDir, stored.path))).toBe(false);
  });

  it('swallows a removal failure (a broken replacement must not fail the save)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const brokenCtx = { db: prisma, files: undefined, user: { id: ownerId } } as never;
    // ctx.files absent: the delete succeeds, the file removal is skipped, no throw.
    const orphan = await prisma.csld_image.create({
      data: { path: `upload/${marker}-nofiles.png`, contenttype: 'image/png' },
    });
    createdImageIds.push(orphan.id);
    await expect(removeProfilePictureIfUnused(brokenCtx, orphan.id)).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
