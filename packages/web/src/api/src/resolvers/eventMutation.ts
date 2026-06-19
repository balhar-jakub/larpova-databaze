import type { Context } from '../context.js';
import { isSignedIn } from '../auth/appUsers.js';
import { GraphQLError } from 'graphql';
import { syncEventToCalendar, deleteCalendarEvent } from '../external/googleCalendar.js';
import { normalizeGame } from './mappers.js';

function requireAuth(ctx: Context) {
  if (!isSignedIn(ctx)) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'AUTHENTICATION_REQUIRED' },
    });
  }
}

interface EventInput {
  name: string;
  fromDate: string;
  toDate: string;
  amountOfPlayers?: number;
  web?: string;
  loc?: string;
  description?: string;
  games: string[];
  labels: string[];
  newLabels: any[];
  latitude?: number;
  longitude?: number;
}

function mapEvent(e: any) {
  return {
    ...e,
    amountOfPlayers: e.amountofplayers,
    location: (e.latitude != null || e.longitude != null)
      ? { lattitude: e.latitude, longtitude: e.longitude }
      : null,
    labels: (e.event_has_labels ?? []).map((j: any) => j.csld_label).filter(Boolean),
    games: (e.csld_game_has_event ?? []).map((j: any) => j.csld_game).filter(Boolean).map((g: any) => normalizeGame(g)),
    allowedActions: null,
  };
}

// ── createEvent ──────────────────────────────────────────

export async function createEventResolver(
  _parent: unknown,
  args: { input: EventInput },
  ctx: Context,
) {
  requireAuth(ctx);
  const { input } = args;

  const event = await ctx.db.event.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      loc: input.loc ?? null,
      web: input.web ?? null,
      from: new Date(input.fromDate),
      to: new Date(input.toDate),
      amountofplayers: input.amountOfPlayers ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      added_by: ctx.user!.id,
      deleted: false,
      lang: 'cs',
    },
  });

  // Link games
  if (input.games?.length) {
    for (const gameId of input.games) {
      await ctx.db.csld_game_has_event.create({
        data: { game_id: parseInt(gameId), event_id: event.id },
      });
    }
  }

  // Link labels
  if (input.labels?.length) {
    for (const labelId of input.labels) {
      await ctx.db.event_has_labels.create({
        data: { event_id: event.id, label_id: parseInt(labelId) },
      });
    }
  }

  // Sync to Google Calendar
  await syncEventToCalendar(ctx.db, event.id).catch((err) => {
    console.error('GCal sync error (create):', err);
  });

  const full = await ctx.db.event.findUnique({
    where: { id: event.id },
    include: {
      event_has_labels: { include: { csld_label: true } },
      csld_game_has_event: { include: { csld_game: true } },
    },
  });

  return full ? mapEvent(full) : null;
}

// ── updateEvent ──────────────────────────────────────────

export async function updateEventResolver(
  _parent: unknown,
  args: { input: EventInput & { id: string } },
  ctx: Context,
) {
  requireAuth(ctx);
  const { input } = args;
  const eventId = parseInt(input.id, 10);
  if (isNaN(eventId)) throw new GraphQLError('Invalid event ID');

  await ctx.db.event.update({
    where: { id: eventId },
    data: {
      name: input.name,
      description: input.description ?? null,
      loc: input.loc ?? null,
      web: input.web ?? null,
      from: new Date(input.fromDate),
      to: new Date(input.toDate),
      amountofplayers: input.amountOfPlayers ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });

  // Resync games
  if (input.games) {
    await ctx.db.csld_game_has_event.deleteMany({ where: { event_id: eventId } });
    for (const gameId of input.games) {
      await ctx.db.csld_game_has_event.create({
        data: { game_id: parseInt(gameId), event_id: eventId },
      });
    }
  }

  // Resync labels
  if (input.labels) {
    await ctx.db.event_has_labels.deleteMany({ where: { event_id: eventId } });
    for (const labelId of input.labels) {
      await ctx.db.event_has_labels.create({
        data: { event_id: eventId, label_id: parseInt(labelId) },
      });
    }
  }

  // Sync to Google Calendar
  await syncEventToCalendar(ctx.db, eventId).catch((err) => {
    console.error('GCal sync error (update):', err);
  });

  const full = await ctx.db.event.findUnique({
    where: { id: eventId },
    include: {
      event_has_labels: { include: { csld_label: true } },
      csld_game_has_event: { include: { csld_game: true } },
    },
  });

  return full ? mapEvent(full) : null;
}

// ── deleteEvent ──────────────────────────────────────────

export async function deleteEventResolver(
  _parent: unknown,
  args: { eventId: string },
  ctx: Context,
) {
  requireAuth(ctx);
  const eventId = parseInt(args.eventId, 10);
  if (isNaN(eventId)) throw new GraphQLError('Invalid event ID');

  await ctx.db.event.update({
    where: { id: eventId },
    data: { deleted: true },
  });

  // Delete from Google Calendar
  const event = await ctx.db.event.findUnique({ where: { id: eventId } });
  if (event?.gcaleventid) {
    await deleteCalendarEvent(event.gcaleventid).catch((err) => {
      console.error('GCal delete error:', err);
    });
    await ctx.db.event.update({
      where: { id: eventId },
      data: { gcaleventid: null },
    });
  }

  const full = await ctx.db.event.findUnique({
    where: { id: eventId },
    include: {
      event_has_labels: { include: { csld_label: true } },
      csld_game_has_event: { include: { csld_game: true } },
    },
  });

  return full ? mapEvent(full) : null;
}
