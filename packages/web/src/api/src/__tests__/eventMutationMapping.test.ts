import { ApolloServer } from '@apollo/server';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { LocalFiles } from '../files/fileService';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

/**
 * Field-mapping and guard arms of resolvers/eventMutation.ts that the
 * permission suites (eventAuthorPermissions) leave cold: the create/update
 * optional-column mapping (every ?? null), the empty games/labels arms, the
 * NaN game id filter of update, the both-null location arm, and the
 * mapEvent projection on a row with no labels/games/location.
 *
 * The permission matrix itself (author/editor/stranger/anonymous) is pinned
 * in eventAuthorPermissions.test.ts and is NOT repeated here.
 */
const stamp = Date.now();
const marker = `evmut-map-${stamp}`;

const CREATE = `
  mutation C($input: CreateEventInput!) {
    event { createEvent(input: $input) { id name description loc web amountOfPlayers location { lattitude longtitude } registrationUrl registrationStatus registrationOpensAt } }
  }`;
const UPDATE = `
  mutation U($input: UpdateEventInput!) {
    event { updateEvent(input: $input) { id name description loc web amountOfPlayers location { lattitude longtitude } coverImage { id contentType } } }
  }`;

let server: ApolloServer;
let files: LocalFiles;
let coverDir: string;
let PNG_B64: string;
let userId: number;
let gameId: number;
let labelId: number;
let eventId: number;

function ctx() {
  return {
    user: {
      id: userId, email: `${marker}@integration.test`, name: marker, nickname: null,
      description: null, role: 2, image: null, amountOfComments: 0, amountOfPlayed: 0, amountOfCreated: 0,
    },
  };
}

beforeAll(async () => {
  server = createTestServer();
  coverDir = mkdtempSync(join(tmpdir(), `csld-evmut-cover-${stamp}`));
  files = new LocalFiles(coverDir);
  PNG_B64 = (
    await sharp({ create: { width: 30, height: 30, channels: 3, background: { r: 80, g: 30, b: 140 } } })
      .png().toBuffer()
  ).toString('base64');
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 2, name: marker, email: `${marker}@integration.test` },
  });
  userId = user.id;
  const game = await prisma.csld_game.create({
    data: { name: `${marker} hra`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameId = game.id;
  const label = await prisma.csld_label.create({
    data: { name: `${marker} štítek`, is_required: false, is_authorized: false, added_by: userId },
  });
  labelId = label.id;
});

afterAll(async () => {
  await prisma.csld_game_has_event.deleteMany({ where: { game_id: gameId } });
  await prisma.event_has_labels.deleteMany({ where: { label_id: labelId } });
  if (eventId) await prisma.event.deleteMany({ where: { id: eventId } });
  await prisma.csld_game.deleteMany({ where: { id: gameId } });
  await prisma.csld_label.deleteMany({ where: { id: labelId } });
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, marker));
  rmSync(coverDir, { recursive: true, force: true });
});

describe('createEvent field mapping', () => {
  it('a minimal event maps every optional to null (games and labels empty)', async () => {
    const res = await executeQuery(
      server, CREATE,
      {
        input: {
          name: `${marker} minimální`,
          fromDate: '2031-05-01',
          toDate: '2031-05-02',
          games: [],
          labels: [],
          newLabels: [],
        },
      },
      ctx(),
    );
    expect(res.errors).toBeUndefined();
    const ev = (res.data as any).event.createEvent;
    expect(ev.description).toBeNull();
    expect(ev.loc).toBeNull();
    expect(ev.web).toBeNull();
    expect(ev.amountOfPlayers).toBeNull();
    expect(ev.location).toBeNull(); // both latitude and longitude absent
    expect(ev.registrationUrl).toBeNull();
    expect(ev.registrationStatus).toBeNull();
    eventId = parseInt(ev.id, 10);
  });

  it('a full event maps every optional and links games and labels', async () => {
    const res = await executeQuery(
      server, CREATE,
      {
        input: {
          name: `${marker} plná`,
          fromDate: '2031-06-01',
          toDate: '2031-06-02',
          description: 'Popis akce',
          loc: 'Brno',
          web: 'https://example.test/akce',
          amountOfPlayers: 40,
          latitude: 49.195,
          longitude: 16.607,
          registrationStatus: 'OPEN',
          registrationUrl: 'https://example.test/registrace',
          games: [String(gameId)],
          labels: [String(labelId)],
          newLabels: [],
        },
      },
      ctx(),
    );
    expect(res.errors).toBeUndefined();
    const ev = (res.data as any).event.createEvent;
    expect(ev.description).toBe('Popis akce');
    expect(ev.loc).toBe('Brno');
    expect(ev.web).toBe('https://example.test/akce');
    expect(ev.amountOfPlayers).toBe(40);
    expect(ev.location).toEqual({ lattitude: 49.195, longtitude: 16.607 });
    expect(ev.registrationStatus).toBe('OPEN');
    const id = parseInt(ev.id, 10);
    expect(await prisma.csld_game_has_event.findFirst({ where: { event_id: id } })).not.toBeNull();
    expect(await prisma.event_has_labels.findFirst({ where: { event_id: id } })).not.toBeNull();
    await prisma.event_has_labels.deleteMany({ where: { event_id: id } });
    await prisma.csld_game_has_event.deleteMany({ where: { event_id: id } });
    await prisma.event.delete({ where: { id } });
  });
});

describe('updateEvent field mapping and guard arms', () => {

  it('an update with every optional set maps them all (the non-null arms)', async () => {
    const res = await executeQuery(
      server, UPDATE,
      {
        input: {
          id: String(eventId),
          name: `${marker} plná po úpravě`,
          fromDate: '2031-07-01',
          toDate: '2031-07-02',
          description: 'Upravený popis',
          loc: 'Ostrava',
          web: 'https://example.test/upravena',
          amountOfPlayers: 33,
          latitude: 49.84,
          longitude: 18.29,
          games: [],
          labels: [],
          newLabels: [],
        },
      },
      ctx(),
    );
    expect(res.errors).toBeUndefined();
    const ev = (res.data as any).event.updateEvent;
    expect(ev.description).toBe('Upravený popis');
    expect(ev.loc).toBe('Ostrava');
    expect(ev.web).toBe('https://example.test/upravena');
    expect(ev.amountOfPlayers).toBe(33);
    expect(ev.location).toEqual({ lattitude: 49.84, longtitude: 18.29 });
  });

  it('an update with a cover image stores it and links it to the event', async () => {
    const res = await executeQuery(
      server, UPDATE,
      {
        input: {
          id: String(eventId),
          name: `${marker} s obálkou`,
          fromDate: '2031-08-01',
          toDate: '2031-08-02',
          coverImage: { fileName: 'cover.png', contents: PNG_B64 },
          games: [],
          labels: [],
          newLabels: [],
        },
      },
      { ...ctx(), files },
    );
    expect(res.errors).toBeUndefined();
    // The mutation's response re-read does not include the cover-image
    // relation, so the saved image is asserted on the stored row.
    const row = await prisma.event.findUnique({
      where: { id: eventId },
      include: { csld_image: true },
    });
    expect(row!.csld_image).not.toBeNull();
    expect(row!.csld_image!.contenttype).toBe('image/png');
  });

  it('deleteEvent clears a stored Google Calendar id (the delete-sync arm)', async () => {
    // The calendar module has no credentials in tests: deleteCalendarEvent
    // throws, the .catch swallows it, and the gcaleventid is still cleared.
    await prisma.event.update({ where: { id: eventId }, data: { gcaleventid: 'gcal-mock-1' } });
    const res = await executeQuery(
      server,
      `mutation D($id: ID!) { event { deleteEvent(eventId: $id) { id deleted } } }`,
      { id: String(eventId) },
      ctx(),
    );
    expect(res.errors).toBeUndefined();
    expect((res.data as any).event.deleteEvent.deleted).toBe(true);
    const row = await prisma.event.findUnique({ where: { id: eventId } });
    expect(row!.gcaleventid).toBeNull();
  });

  it('rejects a malformed id', async () => {
    const res = await executeQuery(
      server, UPDATE,
      {
        input: {
          id: 'not-a-number',
          name: 'x',
          fromDate: '2031-05-01',
          toDate: '2031-05-02',
          games: [],
          labels: [],
          newLabels: [],
        },
      },
      ctx(),
    );
    expect(res.errors?.[0]?.message).toContain('Invalid event ID');
  });

  it('a NaN game id in the list is filtered, not stored', async () => {
    const res = await executeQuery(
      server, UPDATE,
      {
        input: {
          id: String(eventId),
          name: `${marker} minimální`,
          fromDate: '2031-05-03',
          toDate: '2031-05-04',
          games: ['not-a-number', String(gameId)],
          labels: [],
          newLabels: [],
        },
      },
      ctx(),
    );
    expect(res.errors).toBeUndefined();
    const links = await prisma.csld_game_has_event.findMany({ where: { event_id: eventId } });
    expect(links.map((l: any) => l.game_id)).toEqual([gameId]);
    // cleanup the link; the event itself stays for the next test
    await prisma.csld_game_has_event.deleteMany({ where: { event_id: eventId } });
  });

  it('an update without the optional fields clears them (null mapping)', async () => {
    const res = await executeQuery(
      server, UPDATE,
      {
        input: {
          id: String(eventId),
          name: `${marker} minimální`,
          fromDate: '2031-05-05',
          toDate: '2031-05-06',
          games: [],
          labels: [],
          newLabels: [],
        },
      },
      ctx(),
    );
    expect(res.errors).toBeUndefined();
    const ev = (res.data as any).event.updateEvent;
    expect(ev.description).toBeNull();
    expect(ev.loc).toBeNull();
    expect(ev.location).toBeNull();
  });
});
