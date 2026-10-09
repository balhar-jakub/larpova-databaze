import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { LocalFiles } from '../files/fileService';
import sharp from 'sharp';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Event cover images. `Event.coverImage` is the event's own uploaded image when
 * one exists, otherwise the cover image of the first linked game — so a calendar
 * row for a run of a series is not blank just because nobody uploaded a poster
 * for this run. The own image wins over the game fallback, and a mutation that
 * uploads a file writes `event.cover_image` + a `csld_image` row.
 */

let server: ApolloServer;
let dataDir: string;
let files: LocalFiles;

const stamp = Date.now();
const editorEmail = `event-cover-editor-${stamp}@integration.test`;
let editorId: number;

const coverImageSelect = 'coverImage { id }';

async function testPng(width: number, height: number): Promise<string> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 60, b: 120 } },
  }).png().toBuffer();
  return buffer.toString('base64');
}

let gameWithCoverId: number;
let gameWithCoverImageId: number;
let gameWithoutCoverId: number;
let ownImageEventId: number;
let ownImageId: number;
let fallbackEventId: number;
let noImageEventId: number;
let createdEventId: number | null = null;
let uploadedImageIds: number[] = [];

async function createEvent(name: string, gameIds: number[]): Promise<number> {
  const event = await prisma.event.create({
    data: {
      name,
      loc: 'Testovací hrad',
      from: new Date('2027-01-01T00:00:00Z'),
      to: new Date('2027-01-02T00:00:00Z'),
      deleted: false,
      lang: 'cs',
      added_by: editorId,
      csld_game_has_event: { create: gameIds.map(game_id => ({ csld_game: { connect: { id: game_id } } })) },
    },
  });
  return event.id;
}

/** The calendar pages by 100 rows — test events sit in 2027, the fixtures never reach them. */
async function coverImageOf(eventId: number): Promise<string | null> {
  const result = await executeQuery(
    server,
    `query EventById($eventId: ID!) { eventById(eventId: $eventId) { id name ${coverImageSelect} } }`,
    { eventId: String(eventId) },
  );
  expect(result.errors).toBeUndefined();
  return result.data?.eventById?.coverImage?.id ?? null;
}

beforeAll(async () => {
  server = createTestServer();
  dataDir = mkdtempSync(join(tmpdir(), 'csld-event-cover-'));
  files = new LocalFiles(dataDir);

  // createEvent stores added_by = ctx.user.id with a FK to csld_csld_user,
  // so the editor must be a real row, not a context stub.
  editorId = (
    await prisma.csld_csld_user.create({
      data: {
        email: editorEmail,
        name: 'Event Cover Editor',
        nickname: 'eventcover',
        password: '',
        role: 2, // EDITOR
        default_lang: 'cs',
      },
    })
  ).id;

  gameWithCoverImageId = (
    await prisma.csld_image.create({
      data: { path: 'games/test-cover.png', contenttype: 'image/png' },
    })
  ).id;
  gameWithCoverId = (
    await prisma.csld_game.create({
      data: {
        name: `Hra s coverem ${stamp}`,
        year: 2027,
        deleted: false,
        lang: 'cs',
        cover_image: gameWithCoverImageId,
      },
    })
  ).id;
  gameWithoutCoverId = (
    await prisma.csld_game.create({
      data: { name: `Hra bez coveru ${stamp}`, year: 2027, deleted: false, lang: 'cs' },
    })
  ).id;

  ownImageEventId = await createEvent(`Událost s vlastním obrázkem ${stamp}`, [gameWithCoverId]);
  ownImageId = (
    await prisma.csld_image.create({
      data: { path: 'events/own.png', contenttype: 'image/png' },
    })
  ).id;
  await prisma.event.update({ where: { id: ownImageEventId }, data: { cover_image: ownImageId } });

  fallbackEventId = await createEvent(`Událost s fallbackem ${stamp}`, [gameWithoutCoverId, gameWithCoverId]);
  noImageEventId = await createEvent(`Událost bez obrázku ${stamp}`, [gameWithoutCoverId]);
});

afterAll(async () => {
  const events = await prisma.event.findMany({
    where: { id: { in: [ownImageEventId, fallbackEventId, noImageEventId, ...(createdEventId ? [createdEventId] : [])] } },
    select: { id: true, cover_image: true },
  });
  await prisma.csld_game_has_event.deleteMany({
    where: { event_id: { in: [ownImageEventId, fallbackEventId, noImageEventId, ...(createdEventId ? [createdEventId] : [])] } },
  });
  await prisma.event.deleteMany({
    where: { id: { in: [ownImageEventId, fallbackEventId, noImageEventId, ...(createdEventId ? [createdEventId] : [])] } },
  });
  await prisma.csld_game.deleteMany({ where: { id: { in: [gameWithCoverId, gameWithoutCoverId] } } });
  await prisma.csld_csld_user.deleteMany({ where: { email: editorEmail } });
  const imageIds = [
    ...events.map((e) => e.cover_image).filter((id): id is number => id !== null),
    ownImageId,
    gameWithCoverImageId,
    ...uploadedImageIds,
  ];
  await prisma.csld_image.deleteMany({ where: { id: { in: imageIds } } });
  rmSync(dataDir, { recursive: true, force: true });
});

const editorCtx = () => ({ user: { id: editorId, email: editorEmail, name: 'Event Cover Editor', nickname: 'eventcover', description: null, role: 2, image: null } as any, files });

describe('Event.coverImage resolution', () => {
  it('returns the event\'s own image when one is set', async () => {
    const id = await coverImageOf(ownImageEventId);
    // The own image wins over the linked game's cover, not the game's
    expect(Number(id)).toBe(ownImageId);
  });

  it('falls back to the first linked game with a cover image', async () => {
    const id = await coverImageOf(fallbackEventId);
    expect(Number(id)).toBe(gameWithCoverImageId);
  });

  it('is null when neither the event nor any linked game has an image', async () => {
    const id = await coverImageOf(noImageEventId);
    expect(id).toBeNull();
  });
});

describe('Event cover image upload', () => {
  it('stores the uploaded file, links it to the event and serves it back', async () => {
    const contents = await testPng(1000, 300); // 10:3: no crop needed
    const result = await executeQuery(
      server,
      `mutation Create($input: CreateEventInput!) {
        event { createEvent(input: $input) { id name ${coverImageSelect} } }
      }`,
      {
        input: {
          name: `Událost s uploadem ${stamp}`,
          fromDate: '2027-02-01T00:00:00',
          toDate: '2027-02-02T00:00:00',
          games: [String(gameWithoutCoverId)],
          labels: [],
          newLabels: [],
          registrationOpen: false,
          coverImage: { fileName: 'cover.png', contents },
        },
      },
      editorCtx(),
    );

    expect(result.errors).toBeUndefined();
    const created = result.data?.event?.createEvent;
    expect(created?.id).toBeTruthy();
    expect(created?.coverImage?.id).toBeTruthy();
    createdEventId = Number(created.id);
    uploadedImageIds.push(Number(created.coverImage.id));

    // The file landed on disk and the DB row links it
    const image = await prisma.csld_image.findUnique({ where: { id: Number(created.coverImage.id) } });
    expect(image?.path).toBeTruthy();
    const stored = await prisma.event.findUnique({
      where: { id: createdEventId },
      select: { cover_image: true },
    });
    expect(stored?.cover_image).toBe(Number(created.coverImage.id));

    // And the read path serves the own image for this event
    const readBack = await coverImageOf(createdEventId);
    expect(Number(readBack)).toBe(Number(created.coverImage.id));
  });

  it('replaces the image on update', async () => {
    const contents = await testPng(800, 240);
    const result = await executeQuery(
      server,
      `mutation Update($input: UpdateEventInput!) {
        event { updateEvent(input: $input) { id ${coverImageSelect} } }
      }`,
      {
        input: {
          id: String(ownImageEventId),
          name: `Událost s vlastním obrázkem ${stamp}`,
          fromDate: '2027-01-01T00:00:00',
          toDate: '2027-01-02T00:00:00',
          games: [String(gameWithCoverId)],
          labels: [],
          newLabels: [],
          registrationOpen: false,
          coverImage: { fileName: 'new-cover.png', contents },
        },
      },
      editorCtx(),
    );

    expect(result.errors).toBeUndefined();
    const updated = result.data?.event?.updateEvent;
    expect(updated?.coverImage?.id).toBeTruthy();
    const newId = Number(updated.coverImage.id);
    expect(newId).not.toBe(gameWithCoverImageId);
    uploadedImageIds.push(newId);

    const stored = await prisma.event.findUnique({ where: { id: ownImageEventId }, select: { cover_image: true } });
    expect(stored?.cover_image).toBe(newId);
  });
});
