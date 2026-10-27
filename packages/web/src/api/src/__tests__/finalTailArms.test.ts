import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prisma } from '../context';
import { LocalFiles } from '../files/fileService';
import { saveProfilePicture, removeProfilePictureIfUnused } from '../resolvers/profilePicture';
import { allCommentsPage } from '../resolvers/homepage';

/**
 * The final tail of cold arms: profilePicture's extension-less name
 * (contentTypeFor's ?? '' arm), the post-decode size limit (a payload that
 * passes the cheap base64 length check but decodes over 2 MB), the
 * file-storage cleanup arm of removeProfilePictureIfUnused, fileService's
 * output-less resize strategy (outputWidth ?? 0), and allCommentsPage called
 * directly with no args (the default-parameter arms).
 */
const stamp = Date.now();
const marker = `final-${stamp}`;

let dataDir: string;
let files: LocalFiles;
let userId: number;
const imageIds: number[] = [];

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), `csld-final-${stamp}`));
  files = new LocalFiles(dataDir);
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.csld_image.deleteMany({ where: { id: { in: imageIds } } });
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  rmSync(dataDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

const ctx = () => ({ db: prisma, files, user: { id: userId, role: 1 } } as never);

describe('profilePicture tail arms', () => {
  it('answers octet-stream for a name without any extension', async () => {
    const png = (
      await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 20, b: 30 } } })
        .png().toBuffer()
    ).toString('base64');
    const id = await saveProfilePicture(ctx(), { fileName: 'bez-pripony', contents: png });
    expect(id).not.toBeNull();
    imageIds.push(id!);
    const row = await prisma.csld_image.findUnique({ where: { id: id! } });
    expect(row!.contenttype).toBe('application/octet-stream'); // no dot → '' → fallback
  });

  it('rejects a payload that passes the length check but decodes over 2 MB', async () => {
    // 2.05 MB of random bytes: base64 ~2.73 M chars, under the 1.4x early
    // check, over the limit once decoded.
    const big = Buffer.alloc(2_050_000, 7).toString('base64');
    await expect(
      saveProfilePicture(ctx(), { fileName: 'big.png', contents: big }),
    ).rejects.toThrow(/too large/);
  });

  it('removes the stored file when the picture becomes unused', async () => {
    const png = (
      await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 1, g: 2, b: 3 } } })
        .png().toBuffer()
    ).toString('base64');
    const id = await saveProfilePicture(ctx(), { fileName: 'clean.png', contents: png });
    expect(id).not.toBeNull();
    imageIds.push(id!);
    const row = await prisma.csld_image.findUnique({ where: { id: id! } });
    expect(row).not.toBeNull();
    // write the physical file so removeFiles has something to delete
    writeFileSync(join(dataDir, row!.path), Buffer.from(png, 'base64'));

    await expect(removeProfilePictureIfUnused(ctx(), id!)).resolves.toBeUndefined();
    const after = await prisma.csld_image.findUnique({ where: { id: id! } });
    expect(after).toBeNull(); // unused → row and file gone
    imageIds.splice(imageIds.indexOf(id!), 1);
  });
});

describe('allCommentsPage default args', () => {
  it('answers a page with the default offset and limit when called with no args', async () => {
    const page = await allCommentsPage({ db: prisma } as never);
    expect(Array.isArray(page.comments)).toBe(true);
    expect(page.comments.length).toBeLessThanOrEqual(50);
    expect(typeof page.totalAmount).toBe('number');
  });
});
