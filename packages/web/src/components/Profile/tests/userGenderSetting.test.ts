import { resolvers } from '../../../api/src/resolvers/index'
import { genderToNumber, normalizeGender, normalizeUserRef } from '../../../api/src/resolvers/mappers'
import { normalizeUser } from '../../../api/src/resolvers/user'

/**
 * The settings form lets a user state the gender the interface talks about them
 * with ("Hrál jsem" / "Hrála jsem"). The same cases are covered for the API copy
 * in `packages/api/src/__tests__/profileGender.test.ts`, but the web jest config
 * never collects the tests inside `src/api/` and `server.ts` loads
 * `./src/api/src/...` — so without a test here the write path that actually runs
 * in test and production would be unprotected.
 *
 * The database is a hand-written fake: the resolver touches only
 * `csld_csld_user` (the web jest environment cannot load the Prisma client) and
 * it re-reads the row after writing, so the fake has to remember the write.
 */

const updateLoggedInUser = resolvers.UserMutation.updateLoggedInUser as any

function authUser(id = 42) {
    return {
        id,
        email: `gender-test-${id}@integration.test`,
        name: 'Test',
        nickname: null,
        role: 1,
        gender: 0,
        image: null,
        amountOfComments: 0,
        amountOfPlayed: 0,
        amountOfCreated: 0,
    }
}

function fakeDb() {
    const row: any = {
        id: 42,
        email: 'gender-test-42@integration.test',
        name: 'Test',
        nickname: null,
        role: 1,
        gender: 0,
        password: '',
        amount_of_comments: 0,
        amount_of_played: 0,
        amount_of_created: 0,
        image: null,
        csld_image: null,
    }
    const writes: any[] = []
    const db: any = {
        csld_csld_user: {
            findUnique: async () => row,
            update: async (args: any) => {
                writes.push(args)
                Object.assign(row, args.data)
                return row
            },
        },
    }

    return { row, writes, db }
}

const context = (db: any, user: any = authUser()) => ({ user, db, files: null } as any)

const input = (extra: Record<string, unknown> = {}) => ({
    email: 'gender-test-42@integration.test',
    name: 'Test',
    ...extra,
})

describe('the deployed settings mutation stores the gender', () => {
    test('a woman is stored as FEMALE (2)', async () => {
        const fake = fakeDb()

        await updateLoggedInUser({}, { input: input({ gender: 'FEMALE' }) }, context(fake.db))

        expect(fake.writes).toEqual([{ where: { id: 42 }, data: expect.objectContaining({ gender: 2 }) }])
    })

    test('a man is stored as MALE (1)', async () => {
        const fake = fakeDb()

        await updateLoggedInUser({}, { input: input({ gender: 'MALE' }) }, context(fake.db))

        expect(fake.writes[0].data.gender).toBe(1)
    })

    test('"nechci uvádět" clears a previously stated gender', async () => {
        const fake = fakeDb()
        fake.row.gender = 2

        await updateLoggedInUser({}, { input: input({ gender: 'UNSPECIFIED' }) }, context(fake.db))

        expect(fake.writes[0].data.gender).toBe(0)
    })

    test('a client that sends no gender at all keeps the stored one', async () => {
        const fake = fakeDb()
        fake.row.gender = 2

        await updateLoggedInUser({}, { input: input() }, context(fake.db))

        expect('gender' in fake.writes[0].data).toBe(false)
        expect(fake.row.gender).toBe(2)
    })

    test('the returned user carries the enum name, not the database number', async () => {
        const fake = fakeDb()

        const user = await updateLoggedInUser({}, { input: input({ gender: 'FEMALE' }) }, context(fake.db))

        expect(user.gender).toBe('FEMALE')
    })

    test('an anonymous caller changes nothing', async () => {
        const fake = fakeDb()

        await expect(
            updateLoggedInUser({}, { input: input({ gender: 'FEMALE' }) }, context(fake.db, null)),
        ).rejects.toMatchObject({ extensions: { code: 'AUTHENTICATION_REQUIRED' } })
        expect(fake.writes).toEqual([])
    })
})

describe('the deployed copy maps the database number to the enum name', () => {
    test('normalizeGender answers the enum names and never breaks on a stray value', () => {
        expect(normalizeGender(0)).toBe('UNSPECIFIED')
        expect(normalizeGender(1)).toBe('MALE')
        expect(normalizeGender(2)).toBe('FEMALE')
        expect(normalizeGender(null)).toBe('UNSPECIFIED')
        expect(normalizeGender(undefined)).toBe('UNSPECIFIED')
        expect(normalizeGender(99)).toBe('UNSPECIFIED')
    })

    test('genderToNumber maps the enum names back and defaults to UNSPECIFIED', () => {
        expect(genderToNumber('MALE')).toBe(1)
        expect(genderToNumber('FEMALE')).toBe(2)
        expect(genderToNumber('UNSPECIFIED')).toBe(0)
        expect(genderToNumber(undefined)).toBe(0)
        expect(genderToNumber('NONSENSE')).toBe(0)
    })

    test('a user reached through another type carries the name, not the number', () => {
        // A raw row would fail the whole query with
        // `Enum "Gender" cannot represent value: 2`.
        expect(normalizeUserRef({ id: 7, role: 1, gender: 2 }).gender).toBe('FEMALE')
        expect(normalizeUserRef({ id: 7, role: 1 }).gender).toBe('UNSPECIFIED')
    })

    test('the profile owner served by the profile query carries the name too', () => {
        expect(normalizeUser({ id: 7, role: 1, gender: 1, csld_rating: [] }).gender).toBe('MALE')
    })
})
