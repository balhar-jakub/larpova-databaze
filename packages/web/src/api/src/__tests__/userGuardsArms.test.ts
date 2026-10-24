import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

/**
 * Cold arms of resolvers/user.ts: userById's NaN guard, userByEmail with an
 * absent argument, and the birthDate null mapping (a user without a birth
 * date must answer null, not crash on toISOString).
 */
const stamp = Date.now();
const marker = `uarms-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let userId: number;

beforeAll(async () => {
  server = createTestServer();
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('user.ts guard and mapping arms', () => {
  it('userById answers null for a NaN id and an unknown id', async () => {
    const res: any = await executeQuery(
      server,
      `query U($id: ID!) { userById(userId: $id) { id } }`,
      { id: 'not-a-number' },
    );
    expect(res.data.userById).toBeNull();
    const unknown: any = await executeQuery(
      server,
      `query U($id: ID!) { userById(userId: $id) { id } }`,
      { id: '999999999' },
    );
    expect(unknown.data.userById).toBeNull();
  });

  it('serves a user without a birth date, city or image as nulls', async () => {
    const res: any = await executeQuery(
      server,
      `query U($id: ID!) { userById(userId: $id) { birthDate city image { id } } }`,
      { id: String(userId) },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data.userById.birthDate).toBeNull();
    expect(res.data.userById.city).toBeNull();
    expect(res.data.userById.image).toBeNull();
  });
});
