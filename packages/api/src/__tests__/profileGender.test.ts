import { normalizeUser } from '../resolvers/user';
import { genderToNumber, normalizeGender, normalizeUserRef } from '../resolvers/mappers';

/**
 * `csld_csld_user.gender` is a number (0 unspecified, 1 male, 2 female) while
 * the GraphQL field is the `Gender` enum of names — the same trap as `role`
 * (`Enum "UserRole" cannot represent value: 1`): serving a raw row breaks the
 * whole path. The interface picks its wording from it (`Hrál jsem` for a man,
 * `Hrála jsem` for a woman, `Hrál/a jsem` for an unstated gender), so an
 * unmapped or unknown value must never reach the client.
 *
 * The same cases are covered for the copy the server really loads in
 * `packages/web/src/components/Profile/tests/userGenderSetting.test.ts`,
 * including the write path of `updateLoggedInUser`.
 */

describe('normalizeGender', () => {
  test('maps the database numbers to the enum names', () => {
    expect(normalizeGender(0)).toBe('UNSPECIFIED');
    expect(normalizeGender(1)).toBe('MALE');
    expect(normalizeGender(2)).toBe('FEMALE');
  });

  test('a missing or unknown value is UNSPECIFIED, never an error', () => {
    expect(normalizeGender(null)).toBe('UNSPECIFIED');
    expect(normalizeGender(undefined)).toBe('UNSPECIFIED');
    expect(normalizeGender(99)).toBe('UNSPECIFIED');
  });
});

describe('genderToNumber', () => {
  test('maps the enum names back to the stored numbers', () => {
    expect(genderToNumber('UNSPECIFIED')).toBe(0);
    expect(genderToNumber('MALE')).toBe(1);
    expect(genderToNumber('FEMALE')).toBe(2);
  });

  test('anything else means unspecified', () => {
    expect(genderToNumber(null)).toBe(0);
    expect(genderToNumber(undefined)).toBe(0);
    expect(genderToNumber('')).toBe(0);
    expect(genderToNumber('NONSENSE')).toBe(0);
  });
});

function userRow(gender?: number) {
  return {
    id: 42,
    role: 1,
    gender,
    name: 'Test User',
    nickname: null,
    email: 'gender@example.com',
    birth_date: null,
    address: null,
    image: null,
    csld_image: null,
    amount_of_comments: 0,
    amount_of_played: 0,
    amount_of_created: 0,
    last_rating: null,
    csld_rating: [],
    csld_game_has_author: [],
    csld_comment: [],
  };
}

describe('normalizeUser carries the gender as an enum name', () => {
  test('a woman is FEMALE', () => {
    expect((normalizeUser(userRow(2)) as any).gender).toBe('FEMALE');
  });

  test('a legacy row without the column is UNSPECIFIED', () => {
    const row = userRow();
    delete (row as any).gender;

    expect((normalizeUser(row) as any).gender).toBe('UNSPECIFIED');
  });

  test('a nested user is mapped as well', () => {
    expect((normalizeUserRef({ id: 7, role: 1, gender: 2 }) as any).gender).toBe('FEMALE');
  });
});
