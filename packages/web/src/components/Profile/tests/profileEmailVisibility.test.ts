import { resolvers } from '../../../api/src/resolvers/index';
// draft-js is CommonJS: a named import fails to link under the ESM jest runtime.
import DraftJS from 'draft-js';
import { validateRichTextMaxLength } from '../../../utils/validationUtils';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';

/**
 * The email is the account identifier — it is what you sign in with, what a
 * password reset goes to and how a game co-author is matched. It used to be
 * printed next to the name on every profile and served by `userById` /
 * `usersByQuery` to anonymous callers, i.e. the whole address book was one
 * query away. Only the owner and staff may see it.
 *
 * The copied resolver tree is what production runs, but `jest.config.json`
 * skips tests under `src/api/`, so the shipped copy is exercised from here.
 */

const email = resolvers.User.email;

const owner = { id: 42, email: 'wulf@example.com', name: 'Radovan Vlk' };

function ctx(user: any) {
  return { user } as any;
}

describe('User.email visibility', () => {
  test('is hidden from an anonymous reader', () => {
    expect(email(owner, {}, ctx(null))).toBeNull();
  });

  test('is hidden from another signed-in user', () => {
    expect(email(owner, {}, ctx({ id: 7, role: 1 }))).toBeNull();
  });

  test('is returned to the owner, whatever the id type', () => {
    expect(email(owner, {}, ctx({ id: 42, role: 1 }))).toBe('wulf@example.com');
    expect(email({ ...owner, id: '42' }, {}, ctx({ id: 42, role: 1 }))).toBe('wulf@example.com');
    expect(email(owner, {}, ctx({ id: '42', role: 1 }))).toBe('wulf@example.com');
  });

  test('is returned to staff', () => {
    expect(email(owner, {}, ctx({ id: 1, role: 2 }))).toBe('wulf@example.com');
    expect(email(owner, {}, ctx({ id: 1, role: 3 }))).toBe('wulf@example.com');
  });

  test('stays null for a nested user without an email', () => {
    expect(email({ id: 42, name: 'Comment author' }, {}, ctx({ id: 1, role: 3 }))).toBeNull();
  });
});

describe('bio length limit', () => {
  const validate = validateRichTextMaxLength(20);

  test('accepts text at the limit and below', () => {
    expect(validate('x'.repeat(20))).toBeUndefined();
    expect(validate(undefined)).toBeUndefined();
    expect(validate('')).toBeUndefined();
  });

  test('counts the plain text, not the markup', () => {
    expect(validate('<p><strong>' + 'x'.repeat(20) + '</strong></p>')).toBeUndefined();
  });

  test('rejects anything longer', () => {
    expect(validate('x'.repeat(21))).toBe('Errors.richTextTooLong');
    expect(
      validate(DraftJS.EditorState.createWithContent(DraftJS.ContentState.createFromText('x'.repeat(21)))),
    ).toBe('Errors.richTextTooLong');
  });

  test('reads the length of a draft-js editor state', () => {
    expect(
      validate(DraftJS.EditorState.createWithContent(DraftJS.ContentState.createFromText('x'.repeat(20)))),
    ).toBeUndefined();
  });
});

describe('bio rendering', () => {
  /**
   * The bio is user-authored legacy HTML, so it goes through the same
   * `sanitizeHtml` the game description and the comments use — relaxing that
   * would put raw markup on a public page. jsdom cannot exercise the sanitizer
   * itself (its iframe has no `sandbox`, so `sanitizeHtml` bails out and returns
   * the input unchanged), and asserting that bail-out would only pin a hole;
   * the sanitizer is covered wherever a real browser is, i.e. on the deployed
   * instance.
   */
  test('handles an empty bio', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});
