import type { Context } from '../context.js';
import { isSignedIn, isAtLeastEditor } from '../auth/appUsers.js';
import { isLinkedGameAuthor } from './eventPermissions.js';
import { GraphQLError } from 'graphql';
import { syncEventToCalendar, deleteCalendarEvent } from '../external/googleCalendar.js';
import { normalizeGame } from './mappers.js';
import { resolveEventCoverImage, EVENT_COVER_IMAGE_INCLUDE } from './search.js';
import { Base64UploadedFile } from '../files/fileService.js';
import { getCoverImageStrategy } from '../files/imageStrategies.js';
import { isAbsoluteHttpUrl } from '../../../utils/urlUtils.js';

function requireAuth(ctx: Context) {
  if (!isSignedIn(ctx)) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'AUTHENTICATION_REQUIRED' },
    });
  }
}

/**
 * Authors of the games linked to an event may manage the event, editors and
 * admins any event. Without this check any signed-in user could rewrite or
 * delete any event through the API — the buttons were hidden in the UI, the
 * API was not.
 */
async function requireEventAuthorOrEditor(eventId: number, ctx: Context) {
  if (isAtLeastEditor(ctx)) return;
  if (!(await isLinkedGameAuthor(eventId, ctx))) {
    throw new GraphQLError('Not authorized to modify this event', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }
}

interface EventInput {
  name: string;
  fromDate: string;
  toDate: string;
  amountOfPlayers?: number;
  web?: string;
  registrationUrl?: string;
  /** @deprecated use registrationStatus instead */
  registrationOpen?: boolean;
  registrationStatus?: RegistrationStatus | null;
  registrationOpensAt?: string | null;
  loc?: string;
  description?: string;
  games: string[];
  labels: string[];
  newLabels: any[];
  latitude?: number;
  longitude?: number;
  coverImage?: { fileName: string; contents: string };
}

export const REGISTRATION_STATUSES = ['UPCOMING', 'OPEN', 'CLOSED'] as const;
export type RegistrationStatus = typeof REGISTRATION_STATUSES[number];

export function normalizeOptionalHttpUrl(value?: string): string | null {
  const url = value?.trim();
  if (!url) return null;

  try {
    if (!isAbsoluteHttpUrl(url)) throw new Error();
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    throw new GraphQLError('Invalid registration URL', {
      extensions: { code: 'INVALID_VALUE' },
    });
  }
}

/**
 * Resolve the tri-state registration from the input. New clients send
 * `registrationStatus`; the deprecated `registrationOpen` boolean is mapped
 * so old clients keep working (OPEN when true, CLOSED when false and a URL
 * is given, nothing otherwise).
 */
function resolveRegistrationStatus(value: string | undefined | null, open: boolean | undefined, registrationUrl: string | null): RegistrationStatus | null {
  if (value === '') return null;
  if (value != null) {
    if (!(REGISTRATION_STATUSES as readonly string[]).includes(value)) {
      throw new GraphQLError('Invalid registration status', {
        extensions: { code: 'INVALID_VALUE' },
      });
    }
    return value as RegistrationStatus;
  }
  // Legacy boolean input.
  if (open) return 'OPEN';
  if (registrationUrl) return 'CLOSED';
  return null;
}

/**
 * The sign-up opens-at time; stored only while the status is UPCOMING
 * (elsewhere it is meaningless and dropped), always normalized to a Date.
 */
function resolveRegistrationOpensAt(value: string | null | undefined, status: RegistrationStatus | null): Date | null {
  if (status !== 'UPCOMING' || !value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    throw new GraphQLError('Invalid registration opens-at date', {
      extensions: { code: 'INVALID_VALUE' },
    });
  }
  return parsed;
}

export function normalizeRegistrationInput(value: string | undefined, open?: boolean, status?: string | null, opensAt?: string | null) {
  const registrationUrl = normalizeOptionalHttpUrl(value);
  const registrationStatus = resolveRegistrationStatus(status, open, registrationUrl);
  if (registrationStatus === 'OPEN' && !registrationUrl) {
    throw new GraphQLError('Open registration requires a registration URL', {
      extensions: { code: 'INVALID_VALUE' },
    });
  }

  return {
    registrationUrl,
    registrationStatus,
    registrationOpensAt: resolveRegistrationOpensAt(opensAt, registrationStatus),
  };
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
    coverImage: resolveEventCoverImage(e),
    allowedActions: null,
  };
}

/**
 * Save an uploaded cover image for an event: resize/crop it like a game cover,
 * store the file, create the `csld_image` row and link it via `event.cover_image`.
 * Mirrors the game cover upload in `gameMutation.ts`.
 */
async function saveEventCoverImage(ctx: Context, eventId: number, coverImage: { fileName: string; contents: string }) {
  const uploaded = new Base64UploadedFile(coverImage.fileName, coverImage.contents);
  const strategy = getCoverImageStrategy();
  const result = await ctx.files.saveImageAndReturnPath(uploaded, strategy);

  const image = await ctx.db.csld_image.create({
    data: {
      path: result.path,
      contenttype: `image/${coverImage.fileName.split('.').pop()?.toLowerCase() || 'jpeg'}`,
    },
  });

  await ctx.db.event.update({
    where: { id: eventId },
    data: { cover_image: image.id },
  });

  return image;
}

// ── createEvent ──────────────────────────────────────────

export async function createEventResolver(
  _parent: unknown,
  args: { input: EventInput },
  ctx: Context,
) {
  requireAuth(ctx);
  const { input } = args;
  const registration = normalizeRegistrationInput(input.registrationUrl, input.registrationOpen, input.registrationStatus, input.registrationOpensAt);

  const event = await ctx.db.event.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      loc: input.loc ?? null,
      web: input.web ?? null,
      registration_url: registration.registrationUrl,
      registration_status: registration.registrationStatus,
      registration_opens_at: registration.registrationOpensAt,
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

  // Handle cover image upload
  if (input.coverImage?.fileName && input.coverImage?.contents) {
    await saveEventCoverImage(ctx, event.id, input.coverImage);
  }

  const full = await ctx.db.event.findUnique({
    where: { id: event.id },
    include: {
      event_has_labels: { include: { csld_label: true } },
      ...EVENT_COVER_IMAGE_INCLUDE,
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
  await requireEventAuthorOrEditor(eventId, ctx);
  const registration = normalizeRegistrationInput(input.registrationUrl, input.registrationOpen, input.registrationStatus, input.registrationOpensAt);

  // The author of a linked game may not rewrite the game links wholesale:
  // adding a link to a game they author would grant them rights over an
  // event they had none. They may only remove links (e.g. their own game
  // turned out not to run at the event); editors and admins resync freely.
  const gameIds = (input.games ?? []).map((gameId: string) => parseInt(gameId, 10)).filter((id: number) => !isNaN(id));
  if (!isAtLeastEditor(ctx)) {
    const existing = await ctx.db.csld_game_has_event.findMany({
      where: { event_id: eventId },
      select: { game_id: true },
    });
    const existingIds = new Set(existing.map((link: { game_id: number }) => link.game_id));
    const added = gameIds.filter((id: number) => !existingIds.has(id));
    if (added.length > 0) {
      throw new GraphQLError('Not authorized to add game links to this event', {
        extensions: { code: 'ACCESS_DENIED' },
      });
    }
  }

  await ctx.db.event.update({
    where: { id: eventId },
    data: {
      name: input.name,
      description: input.description ?? null,
      loc: input.loc ?? null,
      web: input.web ?? null,
      registration_url: registration.registrationUrl,
      registration_status: registration.registrationStatus,
      registration_opens_at: registration.registrationOpensAt,
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

  // Handle cover image upload
  if (input.coverImage?.fileName && input.coverImage?.contents) {
    await saveEventCoverImage(ctx, eventId, input.coverImage);
  }

  const full = await ctx.db.event.findUnique({
    where: { id: eventId },
    include: {
      event_has_labels: { include: { csld_label: true } },
      ...EVENT_COVER_IMAGE_INCLUDE,
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
  await requireEventAuthorOrEditor(eventId, ctx);

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
