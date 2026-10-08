import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * The search resolvers on top of the engine.
 *
 * Everything here was a user-visible defect on production: `novak` found 2 of
 * the 6 Nováks (diacritics), `Novák Jozef` found nobody (word order), an empty
 * query returned the whole address book, the header search never looked at
 * people or events at all, and neither the calendar nor the event API had a text
 * search. The engine's own rules are unit-tested in `searchEngine.test.ts`;
 * these cases pin the queries and their wiring.
 */

let server: ApolloServer;

const stamp = Date.now();
const marker = `Vyhled${stamp}`;

const games = { noc: 0, bete: 0, deleted: 0 };
const events = { bete: 0, deleted: 0 };
const people = { author: 0, person: 0 };

beforeAll(async () => {
  server = createTestServer();

  const author = await prisma.csld_csld_user.create({
    data: {
      email: `${marker}-autor@integration.test`,
      password: 'x',
      role: 1,
      name: `Autor ${marker} Vávra`,
      nickname: `Vavek${stamp}`,
      amount_of_comments: 0,
      amount_of_played: 0,
      amount_of_created: 0,
    },
  });
  people.author = author.id;

  // Diacritics in the name, the nickname and the city at once.
  const person = await prisma.csld_csld_user.create({
    data: {
      email: `${marker}-osoba@integration.test`,
      password: 'x',
      role: 1,
      name: `Ondřej ${marker} Novák`,
      nickname: `Přezdívka ${marker}`,
      address: `Město ${marker}`,
      amount_of_comments: 0,
      amount_of_played: 0,
      amount_of_created: 0,
    },
  });
  people.person = person.id;

  const noc = await prisma.csld_game.create({
    data: { name: `${marker} Šermířská noc`, deleted: false, year: 2025, total_rating: 10 },
  });
  games.noc = noc.id;
  await prisma.csld_game_has_author.create({ data: { id_game: noc.id, id_user: author.id } });

  const bete = await prisma.csld_game.create({
    data: { name: `${marker} Bête Noire`, deleted: false, year: 2024 },
  });
  games.bete = bete.id;

  const deleted = await prisma.csld_game.create({
    data: { name: `${marker} Smazaná hra`, deleted: true, year: 2025, total_rating: 90 },
  });
  games.deleted = deleted.id;

  const event = await prisma.event.create({
    data: {
      name: `${marker} Bête Noire`,
      loc: `Ostrava ${marker}`,
      from: new Date('2027-05-13T00:00:00.000Z'),
      to: new Date('2027-05-16T00:00:00.000Z'),
      deleted: false,
      lang: 'cs',
    },
  });
  events.bete = event.id;

  const deletedEvent = await prisma.event.create({
    data: { name: `${marker} Zrušená akce`, loc: 'Praha', deleted: true, lang: 'cs' },
  });
  events.deleted = deletedEvent.id;
});

afterAll(async () => {
  await prisma.csld_game_has_author.deleteMany({ where: { id_game: games.noc } });
  await prisma.csld_game.deleteMany({ where: { id: { in: [games.noc, games.bete, games.deleted] } } });
  await prisma.event.deleteMany({ where: { id: { in: [events.bete, events.deleted] } } });
  await prisma.csld_csld_user.deleteMany({ where: { id: { in: [people.author, people.person] } } });
  await prisma.$disconnect();
});

describe('people (usersByQuery, usersByQueryWithTotal)', () => {
  const peopleQuery = `query ($q: String!) {
    usersByQueryWithTotal(query: $q, offset: 0, limit: 10) {
      totalAmount
      users { id name nickname city }
    }
  }`;

  test('a name typed without diacritics finds the accented person', async () => {
    const result = await executeQuery(server, peopleQuery, { q: `${marker} novak` });
    expect(result.errors).toBeUndefined();

    const page = (result.data as any).usersByQueryWithTotal;
    expect(page.users.map((u: any) => Number(u.id))).toContain(people.person);
    expect(page.totalAmount).toBeGreaterThanOrEqual(1);
  });

  test('the word order of the query does not matter', async () => {
    const reversed = await executeQuery(server, peopleQuery, { q: `novak ${marker}` });
    expect(reversed.errors).toBeUndefined();

    const users = (reversed.data as any).usersByQueryWithTotal.users;
    expect(users.map((u: any) => Number(u.id))).toContain(people.person);
  });

  test('the nickname and the city are searchable too', async () => {
    const byNickname = await executeQuery(server, peopleQuery, { q: `prezdivka ${marker}` });
    const byCity = await executeQuery(server, peopleQuery, { q: `mesto ${marker}` });

    expect((byNickname.data as any).usersByQueryWithTotal.users[0].id).toBe(String(people.person));
    expect((byCity.data as any).usersByQueryWithTotal.users[0].id).toBe(String(people.person));
  });

  test('the plain list stays a list, and keeps the email out', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { usersByQuery(query: $q, limit: 5) { id name email } }`,
      { q: `${marker} novak` },
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).usersByQuery[0].email).toBeNull();
  });

  test('a query shorter than two characters searches nothing', async () => {
    const short = await executeQuery(server, peopleQuery, { q: 'a' });
    const empty = await executeQuery(server, peopleQuery, { q: '' });

    expect((short.data as any).usersByQueryWithTotal.totalAmount).toBe(0);
    expect((short.data as any).usersByQueryWithTotal.users).toEqual([]);
    expect((empty.data as any).usersByQueryWithTotal.totalAmount).toBe(0);
  });
});

describe('games (games.byQuery / byQueryWithTotal)', () => {
  test('matches the name without diacritics and regardless of word order', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) {
        games { byQueryWithTotal(query: $q, offset: 0, limit: 10) { totalAmount suggestion games { id name } } }
      }`,
      { q: `sermirska noc ${marker}` },
    );

    expect(result.errors).toBeUndefined();
    const page = (result.data as any).games.byQueryWithTotal;
    expect(page.totalAmount).toBe(1);
    expect(Number(page.games[0].id)).toBe(games.noc);
    expect(page.suggestion).toBeNull();
  });

  test('a game is found through its author name ("hry od …")', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { games { byQuery(query: $q) { id name } } }`,
      { q: `vavra ${marker}` },
    );

    expect(result.errors).toBeUndefined();
    const ids = (result.data as any).games.byQuery.map((g: any) => Number(g.id));
    expect(ids).toContain(games.noc);
  });

  test('a soft deleted game is never found', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { games { byQuery(query: $q) { id } } }`,
      { q: `smazana ${marker}` },
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).games.byQuery).toEqual([]);
  });

  test('an accent in the title survives a query without it', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { games { byQueryWithTotal(query: $q) { totalAmount games { id } } } }`,
      { q: `${marker} bete noire` },
    );

    expect((result.data as any).games.byQueryWithTotal.totalAmount).toBe(1);
    expect(Number((result.data as any).games.byQueryWithTotal.games[0].id)).toBe(games.bete);
  });

  test('a typo comes back as "Mysleli jste…?" with the real spelling', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { games { byQueryWithTotal(query: $q) { totalAmount suggestion } } }`,
      { q: `${marker} beta noire` },
    );

    const page = (result.data as any).games.byQueryWithTotal;
    expect(page.totalAmount).toBe(0);
    // Only the misspelled word is replaced; the rest stays as the visitor typed
    // it, so the comparison ignores the case of their own words.
    expect(page.suggestion.toLowerCase()).toBe(`${marker} bête noire`.toLowerCase());
  });

  test('an empty query no longer lists the database', async () => {
    const result = await executeQuery(server, `{ games { byQueryWithTotal(query: "") { totalAmount } } }`);

    expect(result.errors).toBeUndefined();
    expect((result.data as any).games.byQueryWithTotal.totalAmount).toBe(0);
  });
});

describe('events (eventsByQuery, eventCalendar)', () => {
  test('an event is found by name and by place, without diacritics', async () => {
    const byName = await executeQuery(
      server,
      `query ($q: String!) { eventsByQuery(query: $q) { totalAmount events { id name loc } } }`,
      { q: `bete noire ${marker}` },
    );
    const byPlace = await executeQuery(
      server,
      `query ($q: String!) { eventsByQuery(query: $q) { events { id } } }`,
      { q: `ostrava ${marker}` },
    );

    expect(byName.errors).toBeUndefined();
    expect((byName.data as any).eventsByQuery.totalAmount).toBe(1);
    expect(Number((byName.data as any).eventsByQuery.events[0].id)).toBe(events.bete);
    expect(Number((byPlace.data as any).eventsByQuery.events[0].id)).toBe(events.bete);
  });

  test('a deleted event stays out of the results', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { eventsByQuery(query: $q) { events { id } } }`,
      { q: `zrusena ${marker}` },
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).eventsByQuery.events).toEqual([]);
  });

  test('the calendar takes the same text query', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { eventCalendar(query: $q) { totalAmount events { id name } } }`,
      { q: `${marker} bete` },
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).eventCalendar.totalAmount).toBe(1);
    expect(Number((result.data as any).eventCalendar.events[0].id)).toBe(events.bete);
  });

  test('the search tab pages through the matches', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { eventsByQuery(query: $q, offset: 0, limit: 1) { totalAmount events { id } } }`,
      { q: `${marker} ostrava` },
    );

    expect((result.data as any).eventsByQuery.totalAmount).toBe(1);
    expect((result.data as any).eventsByQuery.events).toHaveLength(1);
  });
});

describe('the unified header search', () => {
  test('answers in every type at once, with the totals', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) {
        search(query: $q, limit: 3) {
          totalGames totalUsers totalEvents totalGroups
          games { id name }
          users { id name city }
          events { id name }
        }
      }`,
      { q: `${marker}` },
    );

    expect(result.errors).toBeUndefined();
    const search = (result.data as any).search;
    expect(Number(search.games[0].id)).toBe(games.noc); // the rated game leads
    expect(search.games.map((g: any) => Number(g.id))).toContain(games.bete);
    expect(search.users.map((u: any) => Number(u.id))).toContain(people.person);
    expect(Number(search.events[0].id)).toBe(events.bete);
    expect(search.totalUsers).toBeGreaterThanOrEqual(2);
    expect(search.totalEvents).toBeGreaterThanOrEqual(1);
  });

  test('a name that only people carry still answers with the people', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { search(query: $q) { totalGames totalUsers users { id } } }`,
      { q: `prezdivka ${marker}` },
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).search.totalGames).toBe(0);
    expect(Number((result.data as any).search.users[0].id)).toBe(people.person);
  });

  test('a short query answers with empty buckets, not with the world', async () => {
    const result = await executeQuery(
      server,
      `{ search(query: "a") { totalGames totalUsers totalEvents totalGroups } }`,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.search).toEqual({
      totalGames: 0,
      totalUsers: 0,
      totalEvents: 0,
      totalGroups: 0,
    });
  });
});

describe('the catalog text filter', () => {
  test('narrows the list and the facets by the same question', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) {
        games { catalog(filter: { query: $q }) { totalAmount games { id name } facets { labels { id count } } } }
      }`,
      { q: `sermirska noc ${marker}` },
    );

    expect(result.errors).toBeUndefined();
    const catalog = (result.data as any).games.catalog;
    expect(catalog.totalAmount).toBe(1);
    expect(Number(catalog.games[0].id)).toBe(games.noc);
    // The game has no labels, so no label may claim a matching game.
    expect(catalog.facets.labels.every((label: any) => label.count === 0)).toBe(true);
  });

  test('a one letter query is ignored instead of emptying the list', async () => {
    const result = await executeQuery(
      server,
      `{ games { catalog(filter: { query: "v" }, order: NameAsc, limit: 1) { totalAmount } } }`,
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).games.catalog.totalAmount).toBeGreaterThan(1);
  });
});

describe('the unified search (the header field)', () => {
  const SEARCH = `query ($q: String!) {
    search(query: $q, limit: 5) {
      totalGames totalUsers totalEvents totalGroups suggestion
      games { id name } users { id name } events { id name }
    }
  }`;

  test('finds people and games at the same time', async () => {
    const result = await executeQuery(server, SEARCH, { q: `${marker} vavra` });

    expect(result.errors).toBeUndefined();
    const search = (result.data as any).search;
    expect(search.totalGames).toBeGreaterThan(0);
    expect(search.totalUsers).toBeGreaterThan(0);
  });

  test('never guesses when it did find something', async () => {
    // "nov" is found in the person (their surname is Novák) while the games have
    // no such word — the games vocabulary would gladly correct it to "noc", and
    // that guess must not reach somebody who is already looking at a result.
    const result = await executeQuery(server, SEARCH, { q: `nov ${marker}` });

    expect(result.errors).toBeUndefined();
    const search = (result.data as any).search;
    expect(search.totalUsers).toBeGreaterThan(0);
    expect(search.suggestion).toBeNull();
  });

  test('offers the corrected wording when it found nothing at all', async () => {
    const result = await executeQuery(server, SEARCH, { q: `beta noire ${marker}` });

    expect(result.errors).toBeUndefined();
    const search = (result.data as any).search;
    const total =
      search.totalGames + search.totalUsers + search.totalEvents + search.totalGroups;
    expect(total).toBe(0);
    expect(search.suggestion).toMatch(/Bête/);
  });
});
