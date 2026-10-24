import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

/**
 * Guard and filter arms of resolvers/event.ts that the other suites leave
 * cold: eventById's NaN/unknown-id nulls and the location/games projection
 * (an event with no coordinates, a soft-deleted linked game hidden from a
 * plain user but served to an editor), and eventCalendar's optional-argument
 * arms (offset/limit defaults, from/to window, requiredLabels, otherLabels).
 */
const stamp = Date.now();
const marker = `evq-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let authorId: number;
let plainEventId: number;
let geoEventId: number;
let deletedGameId: number;
let labelId: number;

const editor = () => ({ user: { id: authorId, role: 3, email: 'x@integration.test' } });
const plain = () => ({ user: { id: authorId, role: 1, email: 'x@integration.test' } });

beforeAll(async () => {
  server = createTestServer();
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  authorId = user.id;

  // A game soft-deleted, linked to the event: a plain user must not see it.
  const deletedGame = await prisma.csld_game.create({
    data: { name: `${marker} smazaná hra`, deleted: true, added_by: authorId, lang: 'cs' },
  });
  deletedGameId = deletedGame.id;

  const noGeo = await prisma.event.create({
    data: {
      name: `${marker} bez souřadnic`,
      from: new Date(Date.UTC(2033, 3, 1)),
      to: new Date(Date.UTC(2033, 3, 2)),
      deleted: false,
      added_by: authorId,
    },
  });
  plainEventId = noGeo.id;
  await prisma.csld_game_has_event.create({ data: { game_id: deletedGameId, event_id: plainEventId } });

  const withGeo = await prisma.event.create({
    data: {
      name: `${marker} se souřadnicemi`,
      from: new Date(Date.UTC(2033, 5, 1)),
      to: new Date(Date.UTC(2033, 5, 2)),
      deleted: false,
      added_by: authorId,
      latitude: 50.087,
      longitude: 14.42,
    },
  });
  geoEventId = withGeo.id;

  const label = await prisma.csld_label.create({
    data: { name: `${marker} štítek`, is_required: false, is_authorized: true, added_by: authorId },
  });
  labelId = label.id;
  await prisma.event_has_labels.create({ data: { event_id: geoEventId, label_id: labelId } });
});

afterAll(async () => {
  await prisma.event_has_labels.deleteMany({ where: { label_id: labelId } });
  await prisma.csld_game_has_event.deleteMany({ where: { game_id: deletedGameId } });
  await prisma.event.deleteMany({ where: { name: { startsWith: marker } } });
  await prisma.csld_game.deleteMany({ where: { id: deletedGameId } });
  await prisma.csld_label.deleteMany({ where: { id: labelId } });
  await prisma.csld_csld_user.deleteMany({ where: { id: authorId } });
  await prisma.$disconnect();
});

describe('eventById guards and projection arms', () => {
  const QUERY = `
    query E($id: ID!) { eventById(eventId: $id) { id name location { lattitude longtitude } games { id } } }`;

  it('a NaN id is null; an unknown id is null', async () => {
    const nan = await executeQuery(server, QUERY, { id: 'not-a-number' });
    expect((nan.data as any).eventById).toBeNull();
    const unknown = await executeQuery(server, QUERY, { id: '999999999' });
    expect((unknown.data as any).eventById).toBeNull();
  });

  it('an event without coordinates serves a null location; one with them serves both', async () => {
    const noGeo = await executeQuery(server, QUERY, { id: String(plainEventId) }, plain());
    expect((noGeo.data as any).eventById.location).toBeNull();
    const geo = await executeQuery(server, QUERY, { id: String(geoEventId) }, plain());
    expect((geo.data as any).eventById.location).toEqual({ lattitude: 50.087, longtitude: 14.42 });
  });

  it('hides a soft-deleted linked game from a plain user and serves it to an editor', async () => {
    const asPlain = await executeQuery(server, QUERY, { id: String(plainEventId) }, plain());
    expect((asPlain.data as any).eventById.games).toHaveLength(0);
    const asEditor = await executeQuery(server, QUERY, { id: String(plainEventId) }, editor());
    const ids = (asEditor.data as any).eventById.games.map((g: any) => Number(g.id));
    expect(ids).toContain(deletedGameId);
  });
});

describe('eventCalendar optional-argument arms', () => {
  const CALENDAR = `
    query C($from: String, $to: String, $requiredLabels: [ID!], $otherLabels: [ID!]) {
      eventCalendar(from: $from, to: $to, requiredLabels: $requiredLabels, otherLabels: $otherLabels) {
        totalAmount
        events { id name }
      }
    }`;

  const findAll = async (vars: Record<string, unknown>, ctxOverride?: unknown) => {
    const res = await executeQuery(
      server,
      CALENDAR,
      vars,
      (ctxOverride as never) ?? undefined,
    );
    expect(res.errors).toBeUndefined();
    const page = (res.data as any).eventCalendar;
    return page.events.filter((e: any) => e.name.startsWith(marker)) as Array<{ id: string; name: string }>;
  };

  it('answers with the defaults (no args at all) and includes the fixture events', async () => {
    const found = await findAll({});
    expect(found.length).toBe(2);
  });

  it('narrows by the from/to window', async () => {
    const inWindow = await findAll({ from: '2033-04-01', to: '2033-04-30' });
    expect(inWindow.map((e) => Number(e.id))).toContain(plainEventId);
    expect(inWindow.map((e) => Number(e.id))).not.toContain(geoEventId);
  });

  it('filters by requiredLabels and by otherLabels', async () => {
    const labelled = await findAll({ requiredLabels: [String(labelId)] });
    expect(labelled.map((e) => Number(e.id))).toEqual([geoEventId]);
    const byOther = await findAll({ otherLabels: [String(labelId)] });
    expect(byOther.map((e) => Number(e.id))).toEqual([geoEventId]);
    const none = await findAll({ requiredLabels: [String(999999)] });
    expect(none).toHaveLength(0);
  });
});
