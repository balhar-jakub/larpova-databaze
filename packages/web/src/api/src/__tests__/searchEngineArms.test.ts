import { describe, it, expect } from '@jest/globals';
import {
  editDistance,
  matchCandidate,
  searchCandidates,
  suggestQuery,
  tokenizeSearchQuery,
  groupEventsByIdentity,
  fetchEventClusterKeys,
  fetchGroupsByIds,
  fetchGamesByIds,
  fetchUsersByIds,
  type SearchCandidate,
} from '../resolvers/search';

/**
 * Direct-call engine arms of resolvers/search.ts that the behaviour suites
 * leave cold: matchCandidate's per-token miss arms, the default rank
 * tiebreak, editDistance's empty-input arms, suggestQuery's tiebreak and
 * stays-as-is arms, event clustering with missing/invalid dates, and the
 * fetch*ByIds empty-ids short-circuits (a page with no matches must not
 * query at all).
 */

const person = (id: number, title: string, extra: string[] = [], rank = 0): SearchCandidate => ({
  id, title, extra, rank,
});

describe('matchCandidate token arms', () => {
  const candidate = person(1, 'Jozef Novák', ['Praha']);

  it('an empty token list never matches', () => {
    expect(matchCandidate([], 'jozef', candidate)).toBeNull();
  });

  it('a candidate without any text never matches', () => {
    expect(matchCandidate(['jozef'], 'jozef', { id: 2, title: '', extra: [] })).toBeNull();
    expect(matchCandidate(['jozef'], 'jozef', { id: 3, title: null as any, extra: [null as any] })).toBeNull();
  });

  it('a token that is not even a substring rejects the candidate', () => {
    expect(matchCandidate(['jozef', 'xxx'], 'jozef xxx', candidate)).toBeNull();
  });

  it('a token found only inside a word keeps the candidate but breaks order', () => {
    const result = matchCandidate(['ovak', 'jozef'], 'ovak jozef', candidate);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(1); // substring, not word start
    expect(result!.inOrder).toBe(false);
  });

  it('words found out of order keep the word-start score but lose inOrder', () => {
    const result = matchCandidate(['novak', 'jozef'], 'novak jozef', candidate);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(2); // every token at a word start
    expect(result!.inOrder).toBe(false);
    const inOrderResult = matchCandidate(['jozef', 'novak'], 'jozef novak', candidate);
    expect(inOrderResult!.inOrder).toBe(true);
  });
});

describe('searchCandidates default tiebreak (rank, then title)', () => {
  it('ranks by rank when scores tie, then by the title alphabetically', () => {
    const aLow = person(1, 'Arca', [], 5);
    const aHigh = person(2, 'Ara', [], 50);
    const aSameHigh = person(3, 'Arb', [], 50);
    const matches = searchCandidates([aLow, aHigh, aSameHigh], 'ar');
    // all three are word-start matches of 'ar'; rank 50 first (Ara before Arb),
    // then rank 5 (Arca).
    expect(matches.map((m) => m.id)).toEqual([2, 3, 1]);
  });

  it('an empty or too-short query matches nothing', () => {
    expect(searchCandidates([person(1, 'abc')], '')).toEqual([]);
    expect(searchCandidates([person(1, 'abc')], null)).toEqual([]);
  });
});

describe('editDistance arms', () => {
  it('identical words are 0, empty inputs are the other length', () => {
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
  });
});

describe('suggestQuery tiebreak arms', () => {
  // Folded vocabulary: 'brda', 'brdo', 'brnda'. The probe tokens are not
  // prefixes of any of these (a prefix would stay unchanged by design).
  const vocabulary = [
    person(1, 'Brda'),
    person(2, 'Brda'), // the more frequent form
    person(3, 'Brdo'),
    person(4, 'Brnda'),
  ];

  it('an equal distance is broken by frequency', () => {
    // 'brta' is distance 1 from both 'Brda' and 'Brdo'; the more frequent Brda wins
    expect(suggestQuery('brta', vocabulary)).toBe('Brda');
  });

  it('a closer word beats a more frequent one', () => {
    // 'brnaa' is distance 1 from 'Brnda' but 2 from 'Brda' — closer wins
    expect(suggestQuery('brnaa', vocabulary)).toBe('Brnda');
  });

  it('a token that prefixes a vocabulary word stays as-is (no suggestion)', () => {
    // 'brd' prefixes 'Brda' → kept unchanged, nothing else correctable → null
    expect(suggestQuery('brd', vocabulary)).toBeNull();
  });

  it('a word nobody is close to stays, the correctable one is corrected', () => {
    const mixed = suggestQuery('qqqqqq brta', vocabulary);
    expect(mixed).toBe('qqqqqq Brda');
  });

  it('an empty vocabulary or a short query suggests nothing', () => {
    expect(suggestQuery('abc', [])).toBeNull();
    expect(suggestQuery('', vocabulary)).toBeNull();
    expect(suggestQuery(null, vocabulary)).toBeNull();
  });
});

describe('event clustering arms (groupEventsByIdentity)', () => {
  const name = 'Opakovaná akce';

  it('clusters by name + dates; a missing date folds to the empty key', () => {
    const clusters = groupEventsByIdentity([
      { id: 1, name, from: new Date('2030-01-01T00:00:00Z'), to: new Date('2030-01-02T00:00:00Z') },
      { id: 2, name, from: '2030-01-01T00:00:00.000Z', to: '2030-01-02T00:00:00.000Z' }, // string form of the same instant
      { id: 3, name, from: null, to: null },
      { id: 4, name, from: null, to: null }, // same missing-instant key as 3
      { id: 5, name: 'Jiná akce', from: null, to: null },
    ]);
    expect(clusters).toHaveLength(3);
    expect(clusters[0]).toMatchObject({ eventId: 1, count: 2, ids: [1, 2] });
    expect(clusters[1]).toMatchObject({ eventId: 3, count: 2, ids: [3, 4] });
    expect(clusters[2]).toMatchObject({ eventId: 5, count: 1, ids: [5] });
  });

  it('an unparseable date folds to its string form (never NaN-equal)', () => {
    const clusters = groupEventsByIdentity([
      { id: 1, name, from: 'not-a-date', to: null },
      { id: 2, name, from: 'not-a-date', to: null },
      { id: 3, name, from: 'also-not-a-date', to: null },
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toMatchObject({ eventId: 1, count: 2 });
  });
});

describe('fetch*ByIds empty-ids short-circuits', () => {
  const emptyDb = {
    event: { findMany: () => { throw new Error('must not query'); } },
    csld_csld_group: { findMany: () => { throw new Error('must not query'); } },
    csld_game: { findMany: () => { throw new Error('must not query'); } },
    csld_csld_user: { findMany: () => { throw new Error('must not query'); } },
  };
  const ctx = { db: emptyDb } as any;

  it('an empty page never touches the database', async () => {
    expect(await fetchEventClusterKeys(ctx, [])).toEqual([]);
    expect(await fetchGroupsByIds(ctx, [])).toEqual([]);
    expect(await fetchGamesByIds(ctx, [])).toEqual([]);
    expect(await fetchUsersByIds(ctx, [])).toEqual([]);
  });
});

describe('tokenizeSearchQuery caps', () => {
  it('a query of many words is capped at the token ceiling', async () => {
    const { MAX_QUERY_TOKENS } = await import('../resolvers/search');
    const many = 'a b c d e f g h i j';
    expect(tokenizeSearchQuery(many).length).toBe(MAX_QUERY_TOKENS);
  });
});
