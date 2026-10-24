import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { calendar_v3 } from 'googleapis';
import { prisma } from '../context';

/**
 * googleCalendar.ts coverage (57% at the Phase 1 baseline — every
 * network-touching path took the catch branch in tests, because no
 * credentials are configured; the module had never made a single client
 * call under test).
 *
 * The module-level client cache now has a test seam
 * (setCalendarClientForTesting, same spirit as setFileService) so the sync
 * logic runs against a fake client: create/update/delete call shapes, the
 * 410-already-deleted tolerance, error swallowing (calendar failures must
 * never fail the event mutation), and syncEventToCalendar's DB contract:
 * create-when-no-gcal-id (persisting the returned id), update-when-present,
 * skip-when-no-date. No network access, no real Google credentials.
 */

const stamp = Date.now();

/** A fake calendar client recording every call. */
function fakeCalendar(opts: {
  insertId?: string;
  failInsert?: boolean;
  failUpdate?: boolean;
  failDelete?: number | false; // HTTP code to fail delete with
} = {}) {
  const calls: { op: string; calendarId?: string; eventId?: string; body?: any }[] = [];
  const client = {
    events: {
      insert: async (params: any) => {
        calls.push({ op: 'insert', calendarId: params.calendarId, body: params.requestBody });
        if (opts.failInsert) throw Object.assign(new Error('insert failed'), { code: 500 });
        return { data: { id: opts.insertId ?? 'gcal-123' } };
      },
      update: async (params: any) => {
        calls.push({ op: 'update', calendarId: params.calendarId, eventId: params.eventId, body: params.requestBody });
        if (opts.failUpdate) throw Object.assign(new Error('update failed'), { code: 500 });
        return { data: {} };
      },
      delete: async (params: any) => {
        calls.push({ op: 'delete', calendarId: params.calendarId, eventId: params.eventId });
        if (opts.failDelete) throw Object.assign(new Error('gone'), { code: opts.failDelete });
        return { data: {} };
      },
    },
  } as unknown as calendar_v3.Calendar;
  return { client, calls };
}

let eventId: number;
let secondEventId: number;

beforeEach(async () => {
  const { setCalendarClientForTesting } = await import('../external/googleCalendar.js');
  setCalendarClientForTesting(null);
});

afterEach(async () => {
  const { setCalendarClientForTesting } = await import('../external/googleCalendar.js');
  setCalendarClientForTesting(null);
});

describe('calendar client configuration', () => {
  it('getCalendarClient throws without credentials (module stays disabled, callers swallow)', async () => {
    const { createCalendarEvent } = await import('../external/googleCalendar.js');
    const prev = process.env.GCAL_CREDENTIALS_BASE64;
    delete process.env.GCAL_CREDENTIALS_BASE64;
    const warn = console.warn;
    const errors: unknown[] = [];
    console.warn = () => {};
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      // returns null, does not throw — createCalendarEvent swallows
      const out = await createCalendarEvent({
        id: 1, name: 'x', description: null, loc: null,
        from: new Date(), to: new Date(),
      });
      expect(out).toBeNull();
    } finally {
      console.warn = warn;
      if (prev !== undefined) process.env.GCAL_CREDENTIALS_BASE64 = prev;
    }
  });
});

describe('createCalendarEvent', () => {
  it('inserts with the event data and returns the gcal id', async () => {
    const mod = await import('../external/googleCalendar.js');
    const { client, calls } = fakeCalendar({ insertId: 'gcal-abc' });
    mod.setCalendarClientForTesting(client);

    const from = new Date('2026-11-01T10:00:00Z');
    const to = new Date('2026-11-01T18:00:00Z');
    const id = await mod.createCalendarEvent({
      id: 1, name: 'Test con', description: 'desc', loc: 'Praha',
      from, to,
    });

    expect(id).toBe('gcal-abc');
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.op).toBe('insert');
    expect(call.calendarId).toBe('primary');
    expect(call.body.summary).toBe('Test con');
    expect(call.body.description).toBe('desc');
    expect(call.body.location).toBe('Praha');
    expect(call.body.start).toEqual({ dateTime: from.toISOString(), timeZone: 'Europe/Prague' });
    expect(call.body.end).toEqual({ dateTime: to.toISOString(), timeZone: 'Europe/Prague' });
  });


  it('syncs an event with to: null and name null (the to ?? from and name fallback arms)', async () => {
    const mod = await import('../external/googleCalendar.js');
    const { client, calls } = fakeCalendar({ insertId: 'gcal-fallback-end' });
    mod.setCalendarClientForTesting(client);

    // An event whose end is NULL and whose name is NULL: sync falls back
    // to the start date for `to` and '' for the summary, and persists the id.
    const undated = await prisma.event.create({
      data: {
        name: null, description: null, loc: null, added_by: null, lang: 'cs',
        from: new Date('2026-11-01T10:00:00Z'), to: null,
      },
    });
    try {
      await mod.syncEventToCalendar(prisma, undated.id);
      expect(calls).toHaveLength(1);
      expect(calls[0].op).toBe('insert');
      expect(calls[0].body.summary).toBe('');          // name ?? ''
      expect(calls[0].body.end.dateTime).toBe(new Date('2026-11-01T10:00:00Z').toISOString()); // to ?? from
      const row = await prisma.event.findUnique({ where: { id: undated.id } });
      expect(row?.gcaleventid).toBe('gcal-fallback-end');
    } finally {
      await prisma.event.deleteMany({ where: { id: undated.id } }).catch(() => {});
    }
  });

  it('returns null when the insert response carries no id', async () => {
    const mod = await import('../external/googleCalendar.js');
    // A client whose insert answers with an EMPTY data object.
    const calls: { op: string }[] = [];
    const client = {
      events: {
        insert: async () => {
          calls.push({ op: 'insert' });
          return { data: {} };
        },
        update: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
      },
    } as unknown as calendar_v3.Calendar;
    mod.setCalendarClientForTesting(client);
    const id = await mod.createCalendarEvent({
      id: 1, name: 'x', from: new Date(), to: new Date(),
    });
    expect(id).toBeNull();
  });

  it('nulls description/loc when missing and returns null on API failure', async () => {
    const mod = await import('../external/googleCalendar.js');
    const { client, calls } = fakeCalendar({ failInsert: true });
    mod.setCalendarClientForTesting(client);
    const err = console.error;
    console.error = () => {};

    try {
      const id = await mod.createCalendarEvent({
        id: 1, name: 'x', from: new Date(), to: new Date(),
      });
      expect(id).toBeNull();
      expect(calls[0].body.description).toBe('');
      expect(calls[0].body.location).toBeUndefined();
    } finally {
      console.error = err;
    }
  });
});

describe('updateCalendarEvent / deleteCalendarEvent', () => {
  it('updates the stored gcal id and swallows API errors', async () => {
    const mod = await import('../external/googleCalendar.js');
    const { client, calls } = fakeCalendar({ failUpdate: true });
    mod.setCalendarClientForTesting(client);
    const err = console.error;
    console.error = () => {};

    try {
      const from = new Date();
      await mod.updateCalendarEvent('gcal-xyz', { name: 'n', description: null, loc: null, from, to: from });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ op: 'update', eventId: 'gcal-xyz' });

      // does not throw despite the failure
      await expect(mod.updateCalendarEvent('gcal-xyz', { name: 'n', from, to: from }))
        .resolves.toBeUndefined();
    } finally {
      console.error = err;
    }
  });

  it('deletes by gcal id; 410 already-deleted is tolerated silently, other codes logged', async () => {
    const mod = await import('../external/googleCalendar.js');
    const { client } = fakeCalendar({ failDelete: 410 });
    mod.setCalendarClientForTesting(client);

    const err = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => logged.push(args);
    try {
      await expect(mod.deleteCalendarEvent('gcal-gone')).resolves.toBeUndefined();
      expect(logged).toHaveLength(0); // 410 → not an error

      const { client: c2 } = fakeCalendar({ failDelete: 500 });
      mod.setCalendarClientForTesting(c2);
      await expect(mod.deleteCalendarEvent('gcal-err')).resolves.toBeUndefined();
      expect(logged).toHaveLength(1); // real failure logged
    } finally {
      console.error = err;
    }
  });
});

describe('syncEventToCalendar (DB contract)', () => {
  beforeEach(async () => {
    const ev = await prisma.event.create({
      data: {
        name: `gcal-test-${stamp}`,
        description: 'fixture',
        added_by: null,
        from: new Date('2026-11-01T10:00:00Z'),
        to: new Date('2026-11-01T18:00:00Z'),
        lang: 'cs',
      },
    });
    eventId = ev.id;

    const ev2 = await prisma.event.create({
      data: {
        name: `gcal-test-2-${stamp}`,
        description: 'fixture',
        added_by: null,
        from: new Date('2026-12-01T10:00:00Z'),
        to: new Date('2026-12-01T18:00:00Z'),
        lang: 'cs',
        gcaleventid: 'gcal-existing',
      },
    });
    secondEventId = ev2.id;
  });

  afterEach(async () => {
    await prisma.event.deleteMany({ where: { id: { in: [eventId, secondEventId] } } }).catch(() => {});
  });

  it('creates and PERSISTS the returned gcal id when the event has none', async () => {
    const mod = await import('../external/googleCalendar.js');
    const { client, calls } = fakeCalendar({ insertId: 'gcal-new-42' });
    mod.setCalendarClientForTesting(client);

    await mod.syncEventToCalendar(prisma, eventId);

    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('insert');
    const row = await prisma.event.findUnique({ where: { id: eventId } });
    expect(row?.gcaleventid).toBe('gcal-new-42');
  });

  it('updates (not inserts) when a gcal id already exists', async () => {
    const mod = await import('../external/googleCalendar.js');
    const { client, calls } = fakeCalendar();
    mod.setCalendarClientForTesting(client);

    await mod.syncEventToCalendar(prisma, secondEventId);

    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('update');
    expect(calls[0].eventId).toBe('gcal-existing');
    const row = await prisma.event.findUnique({ where: { id: secondEventId } });
    expect(row?.gcaleventid).toBe('gcal-existing');
  });

  it('skips events without a date and never touches the client', async () => {
    const mod = await import('../external/googleCalendar.js');
    const { client, calls } = fakeCalendar();
    mod.setCalendarClientForTesting(client);

    const undated = await prisma.event.create({
      data: { name: `gcal-undated-${stamp}`, description: null, added_by: null, lang: 'cs' },
    });
    try {
      await mod.syncEventToCalendar(prisma, undated.id);
      expect(calls).toHaveLength(0);
      // and an unknown id is a no-op too
      await mod.syncEventToCalendar(prisma, 999_999_999);
      expect(calls).toHaveLength(0);
    } finally {
      await prisma.event.deleteMany({ where: { id: undated.id } }).catch(() => {});
    }
  });
});
