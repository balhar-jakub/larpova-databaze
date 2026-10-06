import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { LocalFiles } from '../files/fileService';
import sharp from 'sharp';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Uploading a profile picture used to be a no-op: both `createUser` and
 * `updateLoggedInUser` accepted `profilePicture` and ignored it, so the avatar
 * never changed while the mutation reported success. These tests pin the whole
 * path down — the file on disk, the `csld_image` row, the link from the
 * account and the value the read queries return.
 */

let server: ApolloServer;
let dataDir: string;
let files: LocalFiles;

const stamp = Date.now();
const signupEmail = `picture-signup-${stamp}@integration.test`;
const editEmail = `picture-edit-${stamp}@integration.test`;

async function testPng(width: number, height: number): Promise<string> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 60, b: 120 } },
  }).png().toBuffer();
  return buffer.toString('base64');
}

const imageSelect = 'image { id path }';

beforeAll(async () => {
  server = createTestServer();
  dataDir = mkdtempSync(join(tmpdir(), 'csld-profile-picture-'));
  files = new LocalFiles(dataDir);
});

afterAll(async () => {
  const users = await prisma.csld_csld_user.findMany({
    where: { email: { in: [signupEmail, editEmail] } },
    select: { image: true },
  });
  await prisma.csld_csld_user.deleteMany({ where: { email: { in: [signupEmail, editEmail] } } });
  const imageIds = users.map((u) => u.image).filter((id): id is number => id !== null);
  await prisma.csld_image.deleteMany({ where: { id: { in: imageIds } } });
  rmSync(dataDir, { recursive: true, force: true });
});

describe('Profile picture on signup', () => {
  it('stores the picture, links it to the account and returns it', async () => {
    const contents = await testPng(300, 200); // non-square: the crop has to run
    const result = await executeQuery(
      server,
      `mutation Create($input: CreateUserInput!) { user { createUser(input: $input) { id ${imageSelect} } } }`,
      {
        input: {
          email: signupEmail,
          password: 'pass1234',
          name: 'Picture Signup',
          city: 'Brno',
          recaptcha: 'dev-bypass',
          profilePicture: { fileName: 'profilovka.png', contents },
        },
      },
      { files },
    );

    expect(result.errors).toBeUndefined();
    const image = result.data?.user.createUser.image;
    expect(image).not.toBeNull();

    const row = await prisma.csld_csld_user.findUnique({
      where: { email: signupEmail },
      include: { csld_image: true },
    });
    expect(row?.image).toBe(Number(image.id));
    expect(row?.csld_image?.path).toBe(image.path);
    expect(row?.csld_image?.contenttype).toBe('image/png');

    // The file really is on disk, cropped to the legacy 120x120 square
    expect(existsSync(join(dataDir, image.path))).toBe(true);
    const meta = await sharp(join(dataDir, image.path)).metadata();
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(120);

    // ... and the read path returns the object, not the scalar foreign key
    const read = await executeQuery(
      server,
      `{ userById(userId: "${row?.id}") { id city ${imageSelect} } }`,
      undefined,
      { files },
    );
    expect(read.errors).toBeUndefined();
    expect(read.data?.userById.image).toEqual(image);
    expect(read.data?.userById.city).toBe('Brno');
  });

  it('rejects contents that are not a readable image', async () => {
    const result = await executeQuery(
      server,
      `mutation Create($input: CreateUserInput!) { user { createUser(input: $input) { id } } }`,
      {
        input: {
          email: `picture-broken-${stamp}@integration.test`,
          password: 'pass1234',
          name: 'Broken Picture',
          recaptcha: 'dev-bypass',
          profilePicture: { fileName: 'not-an-image.png', contents: Buffer.from('hello').toString('base64') },
        },
      },
      { files },
    );

    expect(result.errors?.[0].extensions?.code).toBe('VALIDATION_FAILED');
    const leftovers = await prisma.csld_csld_user.count({
      where: { email: `picture-broken-${stamp}@integration.test` },
    });
    expect(leftovers).toBe(0);
  });
});

describe('Profile picture in the settings form', () => {
  let userId: number;
  let firstImageId: number;
  let firstImagePath: string;

  beforeAll(async () => {
    const user = await prisma.csld_csld_user.create({
      data: {
        email: editEmail,
        password: 'x',
        name: 'Picture Edit',
        role: 1,
        address: 'Praha',
        amount_of_comments: 0,
        amount_of_played: 0,
        amount_of_created: 0,
      },
    });
    userId = user.id;
  });

  const sessionUser = () => ({
    id: userId,
    email: editEmail,
    name: 'Picture Edit',
    nickname: null,
    role: 1,
    image: null,
    amountOfComments: 0,
    amountOfPlayed: 0,
    amountOfCreated: 0,
  });

  const update = (input: Record<string, unknown>) =>
    executeQuery(
      server,
      `mutation Update($input: UpdateLoggedInUserInput!) {
        user { updateLoggedInUser(input: $input) { id ${imageSelect} } }
      }`,
      { input: { email: editEmail, name: 'Picture Edit', ...input } },
      { files, user: sessionUser() },
    );

  it('saves an uploaded picture', async () => {
    const result = await update({
      city: 'Praha',
      profilePicture: { fileName: 'new.png', contents: await testPng(240, 240) },
    });

    expect(result.errors).toBeUndefined();
    const image = result.data?.user.updateLoggedInUser.image;
    expect(image).not.toBeNull();
    firstImageId = Number(image.id);
    firstImagePath = image.path;

    const row = await prisma.csld_csld_user.findUnique({ where: { id: userId }, include: { csld_image: true } });
    expect(row?.image).toBe(firstImageId);
    expect(existsSync(join(dataDir, firstImagePath))).toBe(true);
  });

  it('replaces the picture and removes the previous, unused one', async () => {
    const result = await update({
      profilePicture: { fileName: 'newer.png', contents: await testPng(200, 400) },
    });

    expect(result.errors).toBeUndefined();
    const image = result.data?.user.updateLoggedInUser.image;
    expect(Number(image.id)).not.toBe(firstImageId);
    expect(image.path).not.toBe(firstImagePath);

    const row = await prisma.csld_csld_user.findUnique({ where: { id: userId }, include: { csld_image: true } });
    expect(row?.image).toBe(Number(image.id));

    const previous = await prisma.csld_image.findUnique({ where: { id: firstImageId } });
    expect(previous).toBeNull();
    expect(existsSync(join(dataDir, firstImagePath))).toBe(false);
  });

  it('keeps the current picture when the request carries no new one', async () => {
    const before = await prisma.csld_csld_user.findUnique({ where: { id: userId }, select: { image: true } });
    const result = await update({ city: 'Ostrava', name: 'Picture Edit 2' });

    expect(result.errors).toBeUndefined();
    const after = await prisma.csld_csld_user.findUnique({ where: { id: userId }, select: { image: true } });
    expect(after?.image).toBe(before?.image);
  });

  it('returns the city, so saving the form does not wipe it', async () => {
    const result = await executeQuery(
      server,
      `{ loggedInUser { id city ${imageSelect} } }`,
      undefined,
      { files, user: { id: userId, email: editEmail, name: 'Picture Edit 2', nickname: null, role: 1, image: null, amountOfComments: 0, amountOfPlayed: 0, amountOfCreated: 0 } },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.loggedInUser.city).toBe('Ostrava');
  });
});

describe('Profile pictures in user search', () => {
  it('returns the image object instead of the raw foreign key', async () => {
    const user = await prisma.csld_csld_user.findUnique({
      where: { email: signupEmail },
      include: { csld_image: true },
    });
    expect(user?.csld_image).not.toBeNull();

    const result = await executeQuery(
      server,
      `{ usersByQuery(query: "Picture Signup", offset: 0, limit: 5) { id name ${imageSelect} } }`,
      undefined,
      { files },
    );

    expect(result.errors).toBeUndefined();
    const found = result.data?.usersByQuery?.[0];
    expect(found?.id).toBe(String(user?.id));
    expect(found?.image).toEqual({ id: String(user?.csld_image?.id), path: user?.csld_image?.path });
  });
});
