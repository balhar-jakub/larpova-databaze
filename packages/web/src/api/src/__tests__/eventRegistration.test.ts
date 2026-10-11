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
