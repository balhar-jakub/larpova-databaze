/**
 * Comment bodies live in `csld_comment.comment` as HTML, and the older ones are
 * full of entities — the live database holds `&iacute;` in 55 145 rows, `&aacute;`
 * in 47 772 and `&nbsp;` in 4 844 — because they were imported from the legacy
 * site. The API has always stripped tags only, so the entities reached the pages
 * verbatim: the homepage showed `Blackhillu&nbsp;.` and the catalog cards were
 * full of `&iacute;`.
 *
 * Decoding belongs here, next to the tag stripping, so every surface (homepage,
 * game detail, profile, mappers) renders the same text.
 */

/** Latin-1/Latin-2 letters and punctuation that the inherited comments actually use. */
const NAMED_ENTITIES: Record<string, string> = {
  // the ones the database is full of (Czech diacritics)
  aacute: '\u00e1',
  Aacute: '\u00c1',
  cacute: '\u0107',
  Cacute: '\u0106',
  ccaron: '\u010d',
  Ccaron: '\u010c',
  dcaron: '\u010f',
  Dcaron: '\u010e',
  ecaron: '\u011b',
  Ecaron: '\u011a',
  eacute: '\u00e9',
  Eacute: '\u00c9',
  ecirc: '\u00ea',
  Ecirc: '\u00ca',
  iacute: '\u00ed',
  Iacute: '\u00cd',
  ncaron: '\u0148',
  Ncaron: '\u0147',
  oacute: '\u00f3',
  Oacute: '\u00d3',
  ocirc: '\u00f4',
  Ocirc: '\u00d4',
  rcaron: '\u0159',
  Rcaron: '\u0158',
  scaron: '\u0161',
  Scaron: '\u0160',
  tcaron: '\u0165',
  Tcaron: '\u0164',
  uacute: '\u00fa',
  Uacute: '\u00da',
  uring: '\u016f',
  Uring: '\u016e',
  yacute: '\u00fd',
  Yacute: '\u00dd',
  zcaron: '\u017e',
  Zcaron: '\u017d',
  // other European letters seen in the imported rows
  auml: '\u00e4',
  Auml: '\u00c4',
  ouml: '\u00f6',
  Ouml: '\u00d6',
  uuml: '\u00fc',
  Uuml: '\u00dc',
  ntilde: '\u00f1',
  Ntilde: '\u00d1',
  szlig: '\u00df',
  oelig: '\u0153',
  aelig: '\u00e6',
  // punctuation and symbols
  quot: '"',
  apos: "'",
  amp: '&',
  lt: '<',
  gt: '>',
  hellip: '\u2026',
  ndash: '\u2013',
  mdash: '\u2014',
  bdquo: '\u201e',
  ldquo: '\u201c',
  rdquo: '\u201d',
  lsquo: '\u2018',
  rsquo: '\u2019',
  laquo: '\u00ab',
  raquo: '\u00bb',
  bull: '\u2022',
  middot: '\u00b7',
  deg: '\u00b0',
  times: '\u00d7',
  divide: '\u00f7',
  plusmn: '\u00b1',
  euro: '\u20ac',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  sect: '\u00a7',
  para: '\u00b6',
  frac12: '\u00bd',
  frac14: '\u00bc',
  frac34: '\u00be',
  sup2: '\u00b2',
  sup3: '\u00b3',
  // A non-breaking space was a space the author typed; a normal one keeps the
  // text wrappable, which is the point of rendering it as plain text.
  nbsp: ' ',
};

const ENTITY_PATTERN = /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g;

/**
 * Replace HTML entities with their characters. Named entities that are not in
 * the table (or unknown numeric codes) are left untouched rather than dropped —
 * a visible `&foobar;` is a bug report, a vanished word is not.
 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/**
 * The comment as the visitor reads it: tags gone, entities decoded, runs of
 * whitespace (including the decoded non-breaking spaces and the newlines the
 * HTML carried) collapsed to single spaces.
 *
 * `null`/empty in, `null` out — the GraphQL field is nullable and several
 * surfaces use the null to mean "no text".
 */
export function commentAsText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = decodeHtmlEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length ? text : null;
}
