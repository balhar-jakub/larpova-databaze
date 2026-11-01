/**
 * robots.txt rendering, kept separate from server.ts so it is unit-testable.
 *
 * Two audiences:
 * - non-indexable hosts (the test instance, the ples site — anything that is
 *   not the production domain) get a blanket Disallow;
 * - the production host gets `Allow: /`, the app-private paths (/admin,
 *   /graphql) disallowed for everyone, a per-agent Disallow for crawlers that
 *   render the whole app without sending anyone here (measured over the
 *   2026-10-18 → 2026-11-01 access-log window: PetalBot 20 927 requests,
 *   AhrefsBot 13 728 — 5 597 of them on 31 Oct alone), and the sitemap line.
 */

export const INDEXABLE_HOSTS = ['larpovadatabaze.cz', 'www.larpovadatabaze.cz'];

/**
 * Crawlers blocked per-agent on the production host. AhrefsBot and PetalBot /
 * PetalSearch were added after the 2026-11-01 audit: neither was disallowed
 * before (only BLEXBot was), and together they accounted for ~34k of 99k
 * requests in the two-week window. Heavy AI/SEO scrapers that render every
 * page (ExaSearchBot ~71k, AIWebIndex ~29k) are listed too.
 */
export const BLOCKED_CRAWLERS = [
  'AhrefsBot',
  'PetalBot',
  'PetalSearch',
  'ExaSearchBot',
  'AIWebIndex',
  'CCBot',
  'Google-Extended',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'meta-externalagent',
  'Diffbot',
  'Omgilibot',
  'Timpibot',
  'ImagesiftBot',
  'MJ12bot',
  'BLEXBot',
  'DataForSeoBot',
  'Barkrowler',
];

/** True when the request host is the production domain (indexable). */
export const isIndexableHost = (host: string): boolean => INDEXABLE_HOSTS.includes(host);

/** Render robots.txt for a host. Always ends with the sitemap line on indexable hosts. */
export const buildRobotsTxt = (host: string): string => {
  if (!isIndexableHost(host)) {
    return 'User-agent: *\nDisallow: /\n';
  }
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /graphql',
    '',
    ...BLOCKED_CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, 'Disallow: /', '']),
    `Sitemap: https://${host}/sitemap.xml`,
    '',
  ].join('\n');
};
