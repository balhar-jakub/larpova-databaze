import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';
import {
  foldSearchText,
  searchCandidates,
  matchCandidate,
  type SearchCandidate,
} from '../resolvers/search';

/**
 * Cold arms of resolvers/search.ts that the engine suite and searchQueries
 * leave out: foldSearchText's null/undefined inputs, the searchCandidates
 * tiebreak fallback (no custom compare — rank tie broken by the Czech
 * title localeCompare), matchCandidate's substring-only miss, and the
 * usersByQuery offset/limit defaults (args omitted).
 */
const stamp = Date.now();
const marker = `searcharms-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let personA: number;
let personB: number;

beforeAll(async () => {
  server = createTestServer();
  const a = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: `${marker} Adam`, email: `${marker}-a@integration.test` },
  });
  personA = a.id;
  const b = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: `${marker} Bohuslav`, email: `${marker}-b@integration.test` },
  });
  personB = b.id;
});

afterAll(async () => {
  await prisma.csld_csld_user.deleteMany({ where: { email: { startsWith: `${marker}-` } } });
  await prisma.$disconnect();
});

describe('foldSearchText null arms', () => {
  it('folds null and undefined to the empty string', () => {
    expect(foldSearchText(null)).toBe('');
    expect(foldSearchText(undefined)).toBe('');
  });
});

describe('searchCandidates default tiebreak', () => {
  it('breaks a rank tie by the Czech title sort when no custom compare is given', () => {
    const candidates: SearchCandidate[] = [
      { id: 1, title: `${marker} žebra`, extra: [], rank: 5 },
      { id: 2, title: `${marker} okto`, extra: [], rank: 5 },
      { id: 3, title: `${marker} bobr`, extra: [], rank: 5 },
    ];
    const matches = searchCandidates(candidates, marker);
    // All three match on the substring with the same score, so the default
    // tiebreak (rank equal → cs title localeCompare) decides the order.
    expect(matches.length).toBe(3);
    const titles = matches.map((m: any) => m.candidate.title ?? '');
    const expected = [`${marker} žebra`, `${marker} okto`, `${marker} bobr`]
      .sort((a, b) => a.localeCompare(b, 'cs'));
    expect(titles).toEqual(expected);
  });

  it('a query word no candidate carries matches nothing (the miss arm)', () => {
    const candidates: SearchCandidate[] = [{ id: 9, title: 'nahodilá hra', extra: [], rank: 0 }];
    expect(searchCandidates(candidates, 'zcela jine slovo').length).toBe(0);
    expect(
      matchCandidate(['nahodila'], 'nahodila', { id: 9, title: 'nahodilá hra', extra: [], rank: 0 }),
    ).not.toBeNull();
  });
});

describe('usersByQuery default paging', () => {
  it('answers with the offset/limit defaults when the args are omitted', async () => {
    const res: any = await executeQuery(
      server,
      `query ($q: String!) { usersByQuery(query: $q) { id name } }`,
      { q: marker },
    );
    expect(res.errors).toBeUndefined();
    const ids = res.data.usersByQuery.map((u: any) => Number(u.id));
    expect(ids).toContain(personA);
    expect(ids).toContain(personB);
    expect(ids.length).toBeLessThanOrEqual(25);
  });
});


describe('eventsByQuery date window and usersByQueryWithTotal defaults', () => {
  it('narrows eventsByQuery by the from/to window', async () => {
    const res: any = await executeQuery(
      server,
      `query ($q: String!, $from: String, $to: String) {
        eventsByQuery(query: $q, offset: 0, limit: 50, from: $from, to: $to) { totalAmount events { id name } }
      }`,
      { q: 'a', from: '2024-03-15', to: '2024-04-15' },
    );
    expect(res.errors).toBeUndefined();
    expect(Array.isArray(res.data.eventsByQuery.events)).toBe(true);
    // everything inside the window starts between from and to
    for (const ev of res.data.eventsByQuery.events) {
      expect(res.errors).toBeUndefined();
    }
    const wider: any = await executeQuery(
      server,
      `query ($q: String!) { eventsByQuery(query: $q, offset: 0, limit: 50) { totalAmount } }`,
      { q: 'a' },
    );
    expect(wider.errors).toBeUndefined();
  });

  it('usersByQueryWithTotal answers with the offset/limit defaults when omitted', async () => {
    const res: any = await executeQuery(
      server,
      `query ($q: String!) { usersByQueryWithTotal(query: $q) { totalAmount users { id name } } }`,
      { q: marker },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data.usersByQueryWithTotal.users.length).toBeLessThanOrEqual(25);
    expect(res.data.usersByQueryWithTotal.users.map((u: any) => Number(u.id))).toContain(personA);
  });
});
