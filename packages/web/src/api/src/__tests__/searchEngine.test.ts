import {
  MAX_QUERY_TOKENS,
  MIN_QUERY_LENGTH,
  SCORE_EXACT_TITLE,
  SCORE_SUBSTRING,
  SCORE_TITLE_START,
  SCORE_WORD_START,
  editDistance,
  foldSearchText,
  matchCandidate,
  searchCandidates,
  searchWords,
  suggestQuery,
  tokenizeSearchQuery,
  type SearchCandidate,
} from '../resolvers/search';

/**
 * The search engine is the same code for games, people, events and groups.
 *
 * What it has to fix, all of it measured on production: `novak` found 2 of the
 * 6 Nováks, the three examples the search page prints (`he whe`, `na so`,
 * `D L B`) all returned nothing, `Novák Jozef` found nobody while `Jozef Novák`
 * found one, and an empty query returned the whole address book. None of that
 * needs a database to pin down, so the rules are tested here and the resolvers
 * on top of them in `searchQueries.test.ts`.
 */

const person = (id: number, name: string, extra: string[] = []): SearchCandidate => ({
  id,
  title: name,
  extra,
  rank: 0,
});

describe('folding', () => {
  test('strips Czech and Slovak diacritics and the case', () => {
    expect(foldSearchText('Novák')).toBe('novak');
    expect(foldSearchText('ŽLUŤOUČKÝ KŮŇ')).toBe('zlutoucky kun');
    expect(foldSearchText('De la Bête')).toBe('de la bete');
    expect(foldSearchText('Šermířská burza — Ostrava')).toBe('sermirska burza — ostrava');
    expect(foldSearchText(null)).toBe('');
  });

  test('splits text into folded words', () => {
    expect(searchWords('NarutoLARP 2020: Soumrak shinobi')).toEqual([
      'narutolarp',
      '2020',
      'soumrak',
      'shinobi',
    ]);
    expect(searchWords('Praha – Slovanský dům')).toEqual(['praha', 'slovansky', 'dum']);
  });
});

describe('query tokens', () => {
  test('a query shorter than the minimum does not search at all', () => {
    expect(MIN_QUERY_LENGTH).toBeGreaterThan(1);
    expect(tokenizeSearchQuery('')).toEqual([]);
    expect(tokenizeSearchQuery('   ')).toEqual([]);
    expect(tokenizeSearchQuery('n')).toEqual([]);
  });

  test('folds, dedupes and caps the words', () => {
    expect(tokenizeSearchQuery('  Novák  JOZEF ')).toEqual(['novak', 'jozef']);
    expect(tokenizeSearchQuery('novak novak')).toEqual(['novak']);
    expect(tokenizeSearchQuery('a b c d e f g h i')).toHaveLength(MAX_QUERY_TOKENS);
  });

  test('keeps the one letter words of the documented example', () => {
    expect(tokenizeSearchQuery('D L B')).toEqual(['d', 'l', 'b']);
  });
});

describe('matching one row', () => {
  test('an exact title wins', () => {
    expect(matchCandidate(['novak'], 'novak', person(1, 'Novák'))).toEqual({
      score: SCORE_EXACT_TITLE,
      inOrder: true,
    });
    expect(matchCandidate(['novak', 'jozef'], 'novak jozef', person(1, 'Novák Jozef'))).toEqual({
      score: SCORE_EXACT_TITLE,
      inOrder: true,
    });
  });

  test('the words of the query match the start of the words of the title, in any order', () => {
    const row = person(1, 'Pan Novák Jozef');
    expect(matchCandidate(['novak', 'jozef'], 'novak jozef', row)).toEqual({
      score: SCORE_WORD_START,
      inOrder: true,
    });
    expect(matchCandidate(['jozef', 'novak'], 'jozef novak', row)).toEqual({
      score: SCORE_WORD_START,
      inOrder: false,
    });
    // The documented example: one letter words are prefixes of a word too.
    expect(matchCandidate(['d', 'l', 'b'], 'd l b', person(9, 'De la Bête'))).toEqual({
      score: SCORE_WORD_START,
      inOrder: true,
    });
  });

  test('a word inside a word still matches, but scores lowest', () => {
    expect(matchCandidate(['vak'], 'vak', person(1, 'Novák'))?.score).toBe(SCORE_SUBSTRING);
  });

  test('every word of the query has to be found', () => {
    expect(matchCandidate(['novak', 'petr'], 'novak petr', person(1, 'Jozef Novák'))).toBeNull();
    expect(matchCandidate(['novak'], 'novak', person(2, 'Ondřej Novák'))).not.toBeNull();
  });

  test('nickname, city, author and place count as much as the title', () => {
    expect(matchCandidate(['mellor'], 'mellor', person(1, 'Ondřej Novák', ['Mellor', 'Praha']))).not.toBeNull();
    expect(matchCandidate(['praha'], 'praha', person(1, 'Ondřej Novák', ['Mellor', 'Praha']))).not.toBeNull();
  });

  test('a row without any text never matches', () => {
    expect(matchCandidate(['novak'], 'novak', { id: 1, title: null })).toBeNull();
  });
});

describe('ranking', () => {
  const candidates = [
    person(1, 'Novák'),
    person(2, 'Novákovi příbuzní'),
    person(3, 'Jozef Novák'),
    person(4, 'Novakolog'),
    person(5, 'František Přednovák'),
  ];

  test('exact title, then title prefix, then word start, then substring', () => {
    const ids = searchCandidates(candidates, 'novak').map((match) => match.id);

    expect(ids[0]).toBe(1); // Novák — the whole title
    expect(new Set(ids.slice(1, 3))).toEqual(new Set([2, 4])); // the title starts with it
    expect(ids[3]).toBe(3); // Novák at the start of a word
    expect(ids[4]).toBe(5); // Přednovák — inside the word
  });

  test('the order the words were written breaks a tie', () => {
    const rows = [person(1, 'Jozef Novák mladší'), person(2, 'Novák Jozef starší')];
    // Both are word-start matches; only the second one has the words in order.
    expect(searchCandidates(rows, 'novak jozef').map((match) => match.id)).toEqual([2, 1]);
  });

  test('the caller decides the order inside one score', () => {
    const rows: SearchCandidate[] = [
      { id: 1, title: 'Novák', rank: 1 },
      { id: 2, title: 'Novák', rank: 9 },
    ];
    expect(searchCandidates(rows, 'novak').map((match) => match.id)).toEqual([2, 1]);
  });

  test('a query that is too short matches nothing', () => {
    expect(searchCandidates(candidates, 'n')).toEqual([]);
    expect(searchCandidates(candidates, '')).toEqual([]);
  });
});

describe('typo suggestions ("Mysleli jste…?")', () => {
  const candidates = [person(1, 'De la Bête'), person(2, 'Jozef Novák'), person(3, 'Hell on Wheels')];

  test('offers the word as the data writes it', () => {
    expect(suggestQuery('beta', [person(1, 'De la Bête')])).toBe('Bête');
    expect(suggestQuery('novak jozef', candidates)).toBeNull(); // already matches
  });

  test('corrects only the word that needs it', () => {
    expect(suggestQuery('hell on weels', candidates)).toBe('hell on Wheels');
    expect(suggestQuery('jozef novak', candidates)).toBeNull();
  });

  test('stays quiet when nothing is close enough', () => {
    expect(suggestQuery('qqqqqqq', candidates)).toBeNull();
    expect(suggestQuery('zel la bete', candidates)).toBeNull();
    expect(suggestQuery('n', candidates)).toBeNull();
  });

  test('edit distance is a plain Levenshtein', () => {
    expect(editDistance('bete', 'beta')).toBe(1);
    expect(editDistance('novak', 'novak')).toBe(0);
    expect(editDistance('', 'abc')).toBe(3);
  });
});
