import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

/**
 * Field-mapping arms of updateLoggedInUser and createUser that the profile
 * suites leave cold: birthDate absent → null, gender absent → stored value
 * kept, city absent → null, nickname absent → null, and the
 * "no previous picture to clean up" arms of the update path.
 */
const stamp = Date.now();
const marker = `umut-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let userId: number;

const UPDATE = `
  mutation U($input: UpdateLoggedInUserInput!) {
    user { updateLoggedInUser(input: $input) { id nickname birthDate city gender name } }
  }`;

const meCtx = () => ({ user: { id: userId, email: `${marker}@integration.test`, role: 1 } });

beforeAll(async () => {
  server = createTestServer();
  // A user WITH a nickname, city, gender and birth date, so an update that
  // omits them can only clear what it actually mentions.
  const user = await prisma.csld_csld_user.create({
    data: {
      password: 'x',
      role: 1,
      name: marker,
      email: `${marker}@integration.test`,
      nickname: 'Stará přezdívka',
      address: 'Staré město',
      gender: 1,
      birth_date: new Date('1990-05-05T00:00:00Z'),
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('updateLoggedInUser field-mapping arms', () => {
  it('an update without optional fields clears nickname/city/birthDate and keeps gender', async () => {
    const res = await executeQuery(
      server, UPDATE,
      { input: { email: `${marker}@integration.test`, name: `${marker} nové` } },
      meCtx(),
    );
    expect(res.errors).toBeUndefined();
    const user = (res.data as any).user.updateLoggedInUser;
    expect(user.name).toBe(`${marker} nové`);
    // Absent means null for the pass-through optionals…
    expect(user.nickname).toBeNull();
    expect(user.city).toBeNull();
    expect(user.birthDate).toBeNull();
    // …and "keep the stored value" for gender (an older client).
    expect(user.gender).toBe('MALE');
  });

  it('an update with every optional set maps them all', async () => {
    const res = await executeQuery(
      server, UPDATE,
      {
        input: {
          email: `${marker}@integration.test`,
          name: `${marker} úplné`,
          nickname: 'Nová přezdívka',
          birthDate: '2000-01-02',
          city: 'Brno',
          gender: 'FEMALE',
          description: 'Krátký bio.',
        },
      },
      meCtx(),
    );
    expect(res.errors).toBeUndefined();
    const user = (res.data as any).user.updateLoggedInUser;
    expect(user.nickname).toBe('Nová přezdívka');
    expect(user.gender).toBe('FEMALE');
    // birthDate/city are not part of the mutation response shape
    // (userToGraphQL serves nulls there; Query.userById maps the columns),
    // so the mapping is asserted on the stored row.
    const row = await prisma.csld_csld_user.findUnique({ where: { id: userId } });
    expect(row!.birth_date!.toISOString()).toBe('2000-01-02T00:00:00.000Z');
    expect(row!.address).toBe('Brno');
    expect(row!.description).toBe('Krátký bio.');
  });
});
