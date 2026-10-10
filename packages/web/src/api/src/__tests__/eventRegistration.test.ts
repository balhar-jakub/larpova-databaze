import { GraphQLError } from 'graphql';
import { normalizeOptionalHttpUrl, normalizeRegistrationInput } from '../resolvers/eventMutation';

describe('legacy API event registration input', () => {
  it('normalizes a valid open registration', () => {
    expect(normalizeRegistrationInput(' https://example.test/form ', true)).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationOpen: true,
    });
  });

  it('defaults omitted registration state to closed', () => {
    expect(normalizeRegistrationInput('https://example.test/form')).toEqual({
      registrationUrl: 'https://example.test/form',
      registrationOpen: false,
    });
  });

  it('rejects open registration without a URL', () => {
    expect(() => normalizeRegistrationInput(undefined, true)).toThrow(GraphQLError);
  });

  it.each(['javascript:alert(1)', 'data:text/html,hello', '/signup', 'https:example.test', 'not a url'])(
    'rejects an unsafe or malformed registration URL: %s',
    value => {
      expect(() => normalizeOptionalHttpUrl(value)).toThrow(GraphQLError);
    },
  );
});
