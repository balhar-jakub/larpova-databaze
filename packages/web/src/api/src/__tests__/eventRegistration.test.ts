import { GraphQLError } from 'graphql';
import { normalizeOptionalHttpUrl, normalizeRegistrationInput } from '../resolvers/eventMutation';

describe('legacy API event registration input', () => {
  it('normalizes a valid open registration', () => {
    expect(normalizeRegistrationInput(' https://example.test/form ', true)).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationStatus: 'OPEN',
      registrationOpensAt: null,
    });
  });

  it('defaults omitted registration state to closed', () => {
    expect(normalizeRegistrationInput('https://example.test/form')).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationStatus: 'CLOSED',
      registrationOpensAt: null,
    });
  });

  it('rejects open registration without a URL', () => {
    expect(() => normalizeRegistrationInput(undefined, true)).toThrow(GraphQLError);
    expect(() => normalizeRegistrationInput(undefined, undefined, 'OPEN')).toThrow(GraphQLError);
  });

  it('accepts upcoming registration without a URL (the link can be added later)', () => {
    expect(normalizeRegistrationInput(undefined, undefined, 'UPCOMING')).toEqual({
      registrationUrl: null,
      registrationStatus: 'UPCOMING',
      registrationOpensAt: null,
    });
  });

  it.each(['javascript:alert(1)', 'data:text/html,hello', '/signup', 'https:example.com', 'not a url'])(
    'rejects an unsafe or malformed registration URL: %s',
    value => {
      expect(() => normalizeOptionalHttpUrl(value)).toThrow(GraphQLError);
    },
  );
});

// The guards inside normalizeRegistrationInput that the happy paths miss:
// an explicit empty status, an invalid status word, the legacy boolean
// fallbacks, and the opens-at validation.
describe('registration input edge cases', () => {
  it('treats an empty status string as "no status"', () => {
    expect(normalizeRegistrationInput('https://example.test/form', undefined, '')).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationStatus: null,
      registrationOpensAt: null,
    });
  });

  it('rejects a status that is not one of the known words', () => {
    expect(() => normalizeRegistrationInput('https://example.test/form', undefined, 'SOMEDAY')).toThrow(GraphQLError);
  });

  it('legacy boolean: open=true maps to OPEN', () => {
    expect(normalizeRegistrationInput('https://example.test/form', true, null)).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationStatus: 'OPEN',
      registrationOpensAt: null,
    });
  });

  it('legacy boolean: url without open maps to CLOSED', () => {
    expect(normalizeRegistrationInput('https://example.test/form', undefined, null)).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationStatus: 'CLOSED',
      registrationOpensAt: null,
    });
  });

  it('drops an opens-at date unless the status is UPCOMING', () => {
    expect(normalizeRegistrationInput('https://example.test/form', undefined, 'OPEN', '2030-01-01T10:00:00Z')).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationStatus: 'OPEN',
      registrationOpensAt: null,
    });
  });

  it('keeps a valid opens-at date for UPCOMING', () => {
    const res = normalizeRegistrationInput(undefined, undefined, 'UPCOMING', '2030-01-01T10:00:00Z');
    expect(res.registrationOpensAt).toEqual(new Date('2030-01-01T10:00:00Z'));
  });

  it('rejects an unparseable opens-at date', () => {
    expect(() => normalizeRegistrationInput(undefined, undefined, 'UPCOMING', 'next tuesday')).toThrow(GraphQLError);
  });
});
