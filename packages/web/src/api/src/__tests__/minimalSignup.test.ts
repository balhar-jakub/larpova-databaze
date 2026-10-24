import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * Registration only asks for email + password: every other profile field
 * (name included) is optional and filled in from the settings page after
 * signing in. These tests pin the resolver contract of that form.
 */

const stamp = Date.now();
const minimalEmail = `minimal-signup-${stamp}@integration.test`;
const trimmedEmail = `trimmed-signup-${stamp}@integration.test`;
const missingPasswordEmail = `no-password-${stamp}@integration.test`;

let server: ApolloServer;

beforeAll(() => {
  server = createTestServer();
});

afterAll(async () => {
  await prisma.csld_csld_user.deleteMany({
    where: { email: { in: [minimalEmail, trimmedEmail, missingPasswordEmail] } },
  });
});

describe('createUser with only email + password', () => {
  it('creates the account without a name and falls back to the email local part', async () => {
    const result = await executeQuery(
      server,
      `mutation Create($input: CreateUserInput!) { user { createUser(input: $input) { id name email role } } }`,
      {
        input: {
          email: minimalEmail,
          password: 'pass1234',
          recaptcha: 'dev-bypass',
        },
      },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user.createUser).not.toBeNull();

    const row = await prisma.csld_csld_user.findUnique({
      where: { email: minimalEmail },
    });
    expect(row).not.toBeNull();
    // The display name is a placeholder the user can change in settings
    expect(row?.name).toBe('minimal-signup-' + stamp);
    expect(row?.role).toBe(1); // USER
  });

  it('trims a whitespace-only name to the email fallback', async () => {
    const result = await executeQuery(
      server,
      `mutation Create($input: CreateUserInput!) { user { createUser(input: $input) { id name } } }`,
      {
        input: {
          email: trimmedEmail,
          password: 'pass1234',
          name: '   ',
          recaptcha: 'dev-bypass',
        },
      },
    );

    expect(result.errors).toBeUndefined();
    const row = await prisma.csld_csld_user.findUnique({
      where: { email: trimmedEmail },
    });
    expect(row?.name).toBe('trimmed-signup-' + stamp);
  });


  it('stores the optional profile fields when the signup carries them', async () => {
    const email = `full-signup-${stamp}@integration.test`;
    const result = await executeQuery(
      server,
      `mutation Create($input: CreateUserInput!) { user { createUser(input: $input) { id name email role } } }`,
      {
        input: {
          email,
          password: 'pass1234',
          recaptcha: 'dev-bypass',
          name: 'Celé Jméno',
          nickname: 'Přezdívka',
          birthDate: '1992-03-04',
          city: 'Plzeň',
          gender: 'FEMALE',
        },
      },
    );
    expect(result.errors).toBeUndefined();
    const row = await prisma.csld_csld_user.findUnique({ where: { email } });
    expect(row).not.toBeNull();
    expect(row!.name).toBe('Celé Jméno');
    expect(row!.nickname).toBe('Přezdívka');
    expect(row!.birth_date!.toISOString().startsWith('1992-03-04')).toBe(true);
    expect(row!.address).toBe('Plzeň');
  });

  it('still requires a password', async () => {
    const result = await executeQuery(
      server,
      `mutation Create($input: CreateUserInput!) { user { createUser(input: $input) { id } } }`,
      {
        input: {
          email: missingPasswordEmail,
          password: '',
          recaptcha: 'dev-bypass',
        },
      },
    );

    expect(result.errors).toBeDefined();
    expect(result.errors![0].extensions?.code).toBe('VALIDATION_FAILED');
    const row = await prisma.csld_csld_user.findUnique({
      where: { email: missingPasswordEmail },
    });
    expect(row).toBeNull();
  });
});
