import type { Context } from '../context.js';
import type { Prisma } from '@prisma/client';
import { isAtLeastEditor } from '../auth/appUsers.js';

export async function eventByIdResolver(
  _parent: unknown,
  args: { eventId: string },
  ctx: Context,
) {
  const id = parseInt(args.eventId, 10);
  if (isNaN(id)) return null;

  const row = await ctx.db.event.findUnique({
    where: { id },
    include: {
      event_has_labels: { include: { csld_label: true } },
      csld_game_has_event: { include: { csld_game: true } },
    },
  });

  if (!row) return null;

  return {
    ...row,
    amountOfPlayers: row.amountofplayers,
    location: (row.latitude != null || row.longitude != null)
      ? { lattitude: row.latitude, longtitude: row.longitude }
      : null,
    labels: (row.event_has_labels ?? []).map((j) => j.csld_label).filter(Boolean),
    // A game deleted on its detail page must not show up as played at the event
    // either; editors and admins keep seeing it (see `gameByIdResolver`).
    games: (row.csld_game_has_event ?? [])
      .map((j) => j.csld_game)
      .filter((g: any) => g && (isAtLeastEditor(ctx) || !g.deleted)),
    allowedActions: null,
  };
}

export async function eventCalendarResolver(
  _parent: unknown,
  args: {
    offset?: number;
    limit?: number;
    from?: string;
    to?: string;
    requiredLabels?: string[];
    otherLabels?: string[];
  },
  ctx: Context,
) {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 25;

  const andConditions: Prisma.eventWhereInput[] = [
    { deleted: false },
  ];

  if (args.from) {
    andConditions.push({ from: { gte: new Date(args.from) } });
  }
  if (args.to) {
    andConditions.push({ to: { lte: new Date(args.to) } });
  }
  if (args.requiredLabels?.length) {
    andConditions.push({
      event_has_labels: {
        some: {
          csld_label: { id: { in: args.requiredLabels.map(Number) } },
        },
      },
    });
  }
  if (args.otherLabels?.length) {
    andConditions.push({
      event_has_labels: {
        some: {
          csld_label: { id: { in: args.otherLabels.map(Number) } },
        },
      },
    });
  }

  const where: Prisma.eventWhereInput = { AND: andConditions };

  const [events, totalAmount] = await Promise.all([
    ctx.db.event.findMany({
      where,
      orderBy: { from: 'asc' },
      skip: offset,
      take: limit,
      include: {
        event_has_labels: { include: { csld_label: true } },
        csld_game_has_event: { include: { csld_game: true } },
      },
    }),
    ctx.db.event.count({ where }),
  ]);

  return {
    events: events.map((e) => ({
      ...e,
      amountOfPlayers: e.amountofplayers,
      location: (e.latitude != null || e.longitude != null)
        ? { lattitude: e.latitude, longtitude: e.longitude }
        : null,
      labels: (e.event_has_labels ?? []).map((j) => j.csld_label).filter(Boolean),
      games: (e.csld_game_has_event ?? [])
        .map((j) => j.csld_game)
        .filter((g: any) => g && (isAtLeastEditor(ctx) || !g.deleted)),
    })),
    totalAmount,
  };
}

/**
 * Counts of events per month, used by the calendar's season strip and the
 * history chart. Both cover years of data at once, which no list query can do:
 * `eventCalendar` pages by 100 rows, the archive has ~2 600 events.
 *
 * The aggregation runs in JS on purpose. The whole table is a couple of
 * thousand rows of one column, so a single findMany is cheap, it needs no raw
 * SQL (the app talks to PostgreSQL through Prisma only) and the result does not
 * depend on the database's time zone: event dates are stored at 00:00 UTC.
 */
export async function eventCalendarStatsResolver(
  _parent: unknown,
  args: { from?: string; to?: string },
  ctx: Context,
) {
  const andConditions: Prisma.eventWhereInput[] = [{ deleted: false }];
  if (args.from) {
    andConditions.push({ from: { gte: new Date(args.from) } });
  }
  if (args.to) {
    andConditions.push({ from: { lte: new Date(args.to) } });
  }

  const rows = await ctx.db.event.findMany({
    where: { AND: andConditions },
    select: { from: true },
  });

  const counts = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.from) return;
    const date = new Date(row.from);
    if (isNaN(date.getTime())) return;
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const byMonth = Array.from(counts.entries())
    .map(([key, count]) => {
      const [year, month] = key.split('-').map(Number);
      return { year, month, count };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return { totalAmount: rows.length, byMonth };
}

