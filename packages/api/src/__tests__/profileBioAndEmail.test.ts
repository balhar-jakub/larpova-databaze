import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { MAX_BIO_LENGTH } from '../resolvers/userMutation';

/**
 * The profile bio (`csld_csld_user.description`) is a legacy CSLD column: the
 * rewrite neither read it nor wrote it, so 681 users' bios were invisible even
 * though `userById` already carried them.
 *
 * The same read path handed the account email to *every* caller —
 * `usersByQuery(query: "")` served the whole address book without signing in,
 * and the profile page printed it next to the name.
 *
 * These tests pin both paths down: the bio is public, the email is not.
 */

let server: ApolloServer;

const stamp = Date.now();
const bioEmail = `bio-${stamp}@integration.test`;
const otherEmail = `bio-other-${stamp}@integration.test`;
const BIO = '<p>Hraju larpy od roku 2005 a <strong>rád</strong> je hodnotím.</p>';

let userId: number;

/** Context of a signed-in caller, as the server builds it from the session. */
function asUser(id: number, role = 1) {
  return {
    user: {
      id,
      email: bioEmail,
      name: 'Bio Test',
      nickname: 'BioTest',
      description: BIO,
      role,
      image: null,
      amountOfComments: 0,
      amountOfPlayed: 0,
      amountOfCreated: 0,
    },
  };
}

async function storedBio(id: number): Promise<string | null> {
  const row = await prisma.csld_csld_user.findUnique({
    where: { id },
    select: { description: true },
  });
  return row?.description ?? null;
}

beforeAll(async () => {
  server = createTestServer();
  const row = await prisma.csld_csld_user.create({
    data: {
      email: bioEmail,
      password: 'x',
      role: 1,
      name: 'Bio Test',
      nickname: 'BioTest',
      description: BIO,
      amount_of_comments: 0,
      amount_of_played: 0,
      amount_of_created: 0,
    },
  });
  userId = row.id;
  await prisma.csld_csld_user.create({
    data: {
      email: otherEmail,
      password: 'x',
      role: 1,
      name: 'Bio Other',
      description: 'Jiný popis',
      amount_of_comments: 0,
      amount_of_played: 0,
      amount_of_created: 0,
    },
  });
});

afterAll(async () => {
  await prisma.csld_csld_user.deleteMany({ where: { email: { in: [bioEmail, otherEmail] } } });
});

describe('profile bio', () => {
  it('is served with the profile, to anyone', async () => {
    const result = await executeQuery(
      server,
      `{ userById(userId: "${userId}") { id name description } }`,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.userById.description).toBe(BIO);
  });

  it('is editable through the settings mutation and read back', async () => {
    const result = await executeQuery(
      server,
      `mutation Update($input: UpdateLoggedInUserInput!) {
        user { updateLoggedInUser(input: $input) { id description email } }
      }`,
      { input: { email: bioEmail, name: 'Bio Test', description: '<p>Nový popis</p>' } },
      asUser(userId),
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user.updateLoggedInUser.description).toBe('<p>Nový popis</p>');
    // ... and it is your own profile, so your own email comes back with it
    expect(result.data?.user.updateLoggedInUser.email).toBe(bioEmail);
    expect(await storedBio(userId)).toBe('<p>Nový popis</p>');
  });

  it('keeps the stored bio when a request does not mention it (older client)', async () => {
    const result = await executeQuery(
      server,
      `mutation Update($input: UpdateLoggedInUserInput!) {
        user { updateLoggedInUser(input: $input) { id description } }
      }`,
      { input: { email: bioEmail, name: 'Bio Test' } },
      asUser(userId),
    );

    expect(result.errors).toBeUndefined();
    expect(await storedBio(userId)).toBe('<p>Nový popis</p>');
  });

  it('refuses a bio beyond the structural ceiling', async () => {
    const result = await executeQuery(
      server,
      `mutation Update($input: UpdateLoggedInUserInput!) {
        user { updateLoggedInUser(input: $input) { id } }
      }`,
      {
        input: { email: bioEmail, name: 'Bio Test', description: 'x'.repeat(MAX_BIO_LENGTH + 1) },
      },
      asUser(userId),
    );

    expect(result.errors?.[0].extensions?.code).toBe('VALIDATION_FAILED');
    expect(await storedBio(userId)).toBe('<p>Nový popis</p>');
  });

  it('is cleared when the bio is emptied', async () => {
    const result = await executeQuery(
      server,
      `mutation Update($input: UpdateLoggedInUserInput!) {
        user { updateLoggedInUser(input: $input) { id description } }
      }`,
      { input: { email: bioEmail, name: 'Bio Test', description: '' } },
      asUser(userId),
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user.updateLoggedInUser.description).toBeNull();
    expect(await storedBio(userId)).toBeNull();
  });
});

describe('account email', () => {
  it('is not handed to an anonymous reader of a profile', async () => {
    const result = await executeQuery(server, `{ userById(userId: "${userId}") { id email } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data?.userById.email).toBeNull();
  });

  it('is returned to the user themselves', async () => {
    const result = await executeQuery(
      server,
      `{ userById(userId: "${userId}") { id email } }`,
      undefined,
      asUser(userId),
    );

    expect(result.data?.userById.email).toBe(bioEmail);
  });

  it('is returned to staff', async () => {
    const result = await executeQuery(
      server,
      `{ userById(userId: "${userId}") { id email } }`,
      undefined,
      asUser(999999, 2), // an editor looking at someone else's profile
    );

    expect(result.data?.userById.email).toBe(bioEmail);
  });

  it('is not returned to another plain user', async () => {
    const result = await executeQuery(
      server,
      `{ userById(userId: "${userId}") { id email } }`,
      undefined,
      asUser(999998, 1),
    );

    expect(result.data?.userById.email).toBeNull();
  });

  it('is not harvested through usersByQuery without signing in', async () => {
    const result = await executeQuery(server, `{ usersByQuery(query: "", limit: 5) { id email } }`);

    expect(result.errors).toBeUndefined();
    const users = (result.data?.usersByQuery ?? []) as Array<{ email: string | null }>;
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.email === null)).toBe(true);
  });

  it('is not revealed by the signup availability check to a stranger', async () => {
    const result = await executeQuery(
      server,
      `{ userByEmail(email: "${bioEmail}") { id name email } }`,
    );

    expect(result.errors).toBeUndefined();
    // The check needs to know *that* the address is taken (and by which name),
    // never the address itself.
    expect(result.data?.userByEmail.id).toBe(String(userId));
    expect(result.data?.userByEmail.name).toBe('Bio Test');
    expect(result.data?.userByEmail.email).toBeNull();
  });
});
