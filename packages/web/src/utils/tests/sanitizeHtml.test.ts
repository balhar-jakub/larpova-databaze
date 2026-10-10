/**
 * XSS regression tests for the hand-rolled iframe-based sanitizer
 * (`src/utils/sanitizeHtml.ts`).
 *
 * The sanitizer is the last line of defense before user-authored HTML
 * (game descriptions, comments, bios) is rendered with `dangerouslySetInnerHTML`.
 * It is NOT the npm `sanitize-html` package — it is a custom allowlist walker.
 *
 * jsdom does not implement `iframe.sandbox`, so calling `sanitizeHtml` directly
 * falls into the "browser without sandboxed iframes" guard and returns the input
 * UNCHANGED — the walker never runs in a unit test. To exercise the real
 * sanitization path we patch `document.createElement` so the created iframe
 * reports a sandbox set and carries a real jsdom document as its
 * `contentDocument`. The walker then runs against a genuine DOM, which is
 * exactly what it does in the browser.
 *
 * Every vector here must come out either fully stripped or neutralized
 * (attribute removed / protocol dropped). If a future dependency bump or
 * refactor lets one through, this suite goes red BEFORE production does.
 */
type SanitizeFn = (html: string | null | undefined) => string;

/** Load the sanitizer with iframe.sandbox/contentDocument patched so the real walker runs. */
async function loadSanitizer(): Promise<SanitizeFn> {
  // jsdom needs TextEncoder/TextDecoder from node when imported under jest's jsdom env.
  const nodeUtil = (await import('node:util')) as typeof import('node:util');
  if (typeof (globalThis as any).TextEncoder === 'undefined') {
    (globalThis as any).TextEncoder = nodeUtil.TextEncoder;
  }
  if (typeof (globalThis as any).TextDecoder === 'undefined') {
    (globalThis as any).TextDecoder = nodeUtil.TextDecoder;
  }
  const { JSDOM } = (await import('jsdom')) as typeof import('jsdom');

  // The document sanitizeHtml will see in this test environment.
  const realDoc = (globalThis as any).document;
  if (!realDoc) throw new Error('no document in test environment');
  // Stay within ONE DOM realm: create the "iframe document" from the SAME jsdom
  // implementation object jest uses, so appendChild never sees cross-realm nodes.
  const inner = realDoc.implementation.createHTMLDocument('iframe');

  const origCreate = realDoc.createElement.bind(realDoc);
  (realDoc as any).createElement = (tag: string, opts?: any) => {
    const el = origCreate(tag, opts);
    if (tag === 'iframe') {
      Object.defineProperty(el, 'sandbox', { value: { add: () => undefined } });
      Object.defineProperty(el, 'contentDocument', { value: inner });
    }
    return el;
  };

  const { sanitizeHtml } = await import('../sanitizeHtml');
  return sanitizeHtml as SanitizeFn;
}

describe('sanitizeHtml — XSS vectors (real walker path)', () => {
  let sanitize: SanitizeFn;
  beforeAll(async () => {
    sanitize = await loadSanitizer();
  });

  const vectors: Array<{ name: string; input: string; mustNotContain: string[] }> = [
    {
      name: 'script tag is dropped',
      input: '<p>ok</p><script>alert(1)</script>',
      mustNotContain: ['script', 'alert'],
    },
    {
      name: 'inline event handler is dropped (img onerror)',
      input: '<img src="x.png" onerror="alert(1)">',
      mustNotContain: ['onerror', 'alert'],
    },
    {
      name: 'javascript: URL in href is neutralized',
      input: '<a href="javascript:alert(1)">click</a>',
      mustNotContain: ['javascript:', 'alert'],
    },
    {
      name: 'data:text/html URL is neutralized',
      input: '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
      mustNotContain: ['data:'],
    },
    {
      name: 'vbscript: URL is neutralized',
      input: '<a href="vbscript:msgbox(1)">x</a>',
      mustNotContain: ['vbscript:'],
    },
    {
      name: 'SVG with SMIL animate is dropped (svg not allowlisted)',
      input: '<svg><animate attributeName="href" values="javascript:alert(1)" /><a><text>x</text></a></svg>',
      mustNotContain: ['animate', 'javascript:'],
    },
    {
      name: 'iframe injection is dropped',
      input: '<iframe src="https://evil.example"></iframe>',
      mustNotContain: ['iframe', 'evil.example'],
    },
    {
      name: 'object/embed are dropped',
      input: '<object data="https://evil.example/x.swf"></object><embed src="https://evil.example">',
      mustNotContain: ['object', 'embed', 'evil.example'],
    },
    {
      name: 'form (content tag) converts to DIV without javascript: action',
      input: '<form action="javascript:alert(1)"><input></form>',
      mustNotContain: ['javascript:', 'action=', 'alert'],
    },
    {
      name: 'style attribute keeps only CSS allowlist (no position, no url(javascript:))',
      input: '<p style="color:red; position:fixed; background:url(javascript:alert(1))">x</p>',
      mustNotContain: ['position', 'javascript:', 'alert'],
    },
    {
      name: 'meta refresh is dropped',
      input: '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      mustNotContain: ['meta', 'refresh'],
    },
  ];

  it.each(vectors)('$name', ({ input, mustNotContain }) => {
    const out = sanitize(input);
    const lower = (out || '').toLowerCase();
    for (const forbidden of mustNotContain) {
      expect(lower).not.toContain(forbidden.toLowerCase());
    }
  });

  it('keeps benign formatting through the allowlist', () => {
    const out = sanitize('<p style="color:red">ahoj <b>světe</b></p>');
    expect(out.toLowerCase()).toContain('ahoj');
    expect(out.toLowerCase()).toContain('<b>světe</b>');
    expect(out.toLowerCase()).toContain('color');
  });

  it('keeps plain links with http(s) working', () => {
    const out = sanitize('<a href="https://larpovadatabaze.cz">ČSLD</a>');
    expect(out).toContain('https://larpovadatabaze.cz');
  });

  it('drops on* attributes wholesale (onmouseover)', () => {
    const out = sanitize('<p onmouseover="alert(1)">x</p>');
    expect(out.toLowerCase()).not.toContain('onmouseover');
    expect(out.toLowerCase()).not.toContain('alert');
  });
});
