import { GraphQLError } from 'graphql';
import { jest } from '@jest/globals';
import {
  createEventResolver,
  normalizeOptionalHttpUrl,
  normalizeRegistrationInput,
  updateEventResolver,
} from '../../api/src/resolvers/eventMutation';
import { resolvers } from '../../api/src/resolvers';

describe('normalizeOptionalHttpUrl', () => {
  it('normalizes an HTTPS registration URL', () => {
    expect(normalizeOptionalHttpUrl(' https://example.test/signup ')).toBe('https://example.test/signup');
  });

  it('returns null for an empty registration URL', () => {
    expect(normalizeOptionalHttpUrl('   ')).toBeNull();
  });

  it.each(['javascript:alert(1)', 'data:text/html,hello', '/signup', 'https:example.com', 'not a url'])(
    'rejects an unsafe or malformed registration URL: %s',
    (value) => {
      expect(() => normalizeOptionalHttpUrl(value)).toThrow(GraphQLError);
      try {
        normalizeOptionalHttpUrl(value);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect((error as GraphQLError).extensions.code).toBe('INVALID_VALUE');
      }
    },
  );
});

describe('normalizeRegistrationInput', () => {
  it('rejects open registration without a URL', () => {
    expect(() => normalizeRegistrationInput(undefined, true)).toThrow(GraphQLError);
  });

  it('normalizes a valid open registration', () => {
    expect(normalizeRegistrationInput(' https://example.test/form ', true)).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationOpen: true,
    });
  });

  it('allows a closed registration link', () => {
    expect(normalizeRegistrationInput('https://example.test/form', false)).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationOpen: false,
    });
  });

  it('defaults omitted registration state to closed', () => {
    expect(normalizeRegistrationInput('https://example.test/form')).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationOpen: false,
    });
  });
});

const eventInput = {
  name: 'Test event',
  fromDate: '2026-10-01T10:00:00.000Z',
  toDate: '2026-10-01T18:00:00.000Z',
  games: [],
  labels: [],
  newLabels: [],
  registrationUrl: 'https://example.test/form',
  registrationOpen: true,
};

const eventRow = {
  id: 123,
  name: eventInput.name,
  from: new Date(eventInput.fromDate),
  to: new Date(eventInput.toDate),
  registration_url: eventInput.registrationUrl,
  registration_open: true,
  event_has_labels: [],
  csld_game_has_event: [],
};

const createContext = () => {
  const event = {
    create: jest.fn(async () => ({ id: eventRow.id })),
    update: jest.fn(async () => ({ id: eventRow.id })),
    findUnique: jest.fn()
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(eventRow as never),
  };

  return {
    event,
    context: {
      user: { id: 42 },
      db: {
        event,
        csld_game_has_event: {
          create: jest.fn(),
          deleteMany: jest.fn(),
        },
        event_has_labels: {
          create: jest.fn(),
          deleteMany: jest.fn(),
        },
      },
    } as any,
  };
};

describe('event registration persistence', () => {
  it('writes snake_case registration fields when creating an event', async () => {
    const { event, context } = createContext();

    await createEventResolver(null, { input: eventInput }, context);

    expect(event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registration_url: 'https://example.test/form',
        registration_open: true,
      }),
    });
  });

  it('writes snake_case registration fields when updating an event', async () => {
    const { event, context } = createContext();

    await updateEventResolver(null, { input: { id: '123', ...eventInput } }, context);

    expect(event.update).toHaveBeenCalledWith({
      where: { id: 123 },
      data: expect.objectContaining({
        registration_url: 'https://example.test/form',
        registration_open: true,
      }),
    });
  });
});

describe('event registration GraphQL field mapping', () => {
  it('maps snake_case database fields', () => {
    expect(resolvers.Event.registrationUrl(eventRow)).toBe('https://example.test/form');
    expect(resolvers.Event.registrationOpen(eventRow)).toBe(true);
  });

  it('defaults legacy rows without registration fields', () => {
    expect(resolvers.Event.registrationUrl({})).toBeNull();
    expect(resolvers.Event.registrationOpen({})).toBe(false);
  });
});
