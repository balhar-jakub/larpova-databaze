import type { Context } from '../context.js';
import type { Prisma } from '@prisma/client';

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
    games: (row.csld_game_has_event ?? []).map((j) => j.csld_game).filter(Boolean),
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
      games: (e.csld_game_has_event ?? []).map((j) => j.csld_game).filter(Boolean),
    })),
    totalAmount,
  };
}
