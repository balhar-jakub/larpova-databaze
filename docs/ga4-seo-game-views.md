# GA4 exploration: is the 02 Oct SEO work paying off on game-detail views?

How to measure, in GA4, whether the sitemap.xml / robots.txt / canonical deploy of
**02 Oct 2026 17:29** (commit `feat(seo): add robots.txt, sitemap.xml and canonical
tags`) brings more organic search traffic to game detail pages (`/larp/*`). No GA4
API key is handled in code — this is a click-through recipe plus a log-based
before/after baseline, to be re-run monthly.

## What the app already sends

- Measurement id `G-SNW4QBGSLW` is inlined at build time via
  `NEXT_PUBLIC_GA_TRACKING_ID` (`packages/web/src/utils/gtag.ts`); the gtag script
  loads in `pages/_document/index.tsx` only when an id is configured and the build
  is production. Consent Mode v2 is default-denied; the cookie banner upgrades it.
- The initial pageview comes from the `config` call. Every client-side navigation
  sends an explicit `page_view` with **both** `page_location` (absolute) and
  `page_path` (path + query) via `registerGTagPageview(url)` in
  `pages/_app.tsx` → `routeChangeComplete` (`packages/web/src/utils/gtag.ts:72`).
  So `page_path` is always present and filterable, e.g. `/larp/ve-znameni-zla/cs/534`.
- Verified live: `https://larpovadatabaze.cz/larp/ve-znameni-zla/cs/534` answers 200
  and the served HTML carries `gtag/js?id=G-SNW4QBGSLW`.
- GA4 records **pageviews only** — `registerGTagEvent` has no callers, so there are
  no custom events. Do not look for contribution events in GA4; use the access log
  and the DB (`csld_game.added`, `csld_rating.added`, `csld_comment.added`).

## Sitemap coverage check (done 2026-11-01, re-run monthly)

`GET https://larpovadatabaze.cz/sitemap.xml` → **200, 349 156 bytes**, and it
contains **1 634** `/larp/<slug>/cs/<id>` game URLs (plus `/event/`, `/group/` and
the static pages). The generator (`packages/web/src/utils/sitemap.ts`) builds game
URLs with the same `gameUrl()` the router renders, so sitemap and rendered links can
not drift apart. The legacy short shape `/larp/:slug/:id(\d+)` (no `/cs/`) is a
rewrite in `next.config.mjs` to the same page and is intentionally **not** in the
sitemap — it is a redirect-equivalent alias, not a second URL to index.

If a `/larp/` shape is ever missing: check `gameUrl()` in
`packages/web/src/utils/urls.ts` and the rewrite table in `next.config.mjs` — both
must cover every public game-detail URL — then `buildSitemapXml` in
`packages/web/src/utils/sitemap.ts` and its test
`packages/web/src/utils/tests/sitemap.test.ts`.

## GA4 exploration recipe (property G-SNW4QBGSLW)

In GA4 → Explore → new **Free form** exploration:

1. **Date range**: two comparisons — `2026-09-01 → 2026-09-30` (before) and
   `2026-10-02 → <current>` (after the sitemap deploy). Use the comparison feature
   ("Add comparison", "Date range" = custom) so both phases show side by side.
2. **Segment / filter**: include only `Page path` (dimension `Page path`, i.e.
   `page_path`) **contains** `/larp/`. This selects game-detail pageviews only.
3. **Rows (dimensions)**:
   - `Session source / medium` (dimension `Session source / medium`) — the
     `google / organic` vs `direct` vs `referral` split that answers the question;
   - optionally `Page path` to see which games the organic inflow lands on.
4. **Values (metrics)**: `Views` (pageviews), `Active users`, `Sessions`,
   `Views per session`.
5. **Filter out internal/test traffic**: the test instance `csld.vezlute.cz`
   deliberately carries no GA tag (per the audit), so no test pageviews reach this
   property; if a Hostname dimension is available, still exclude `hostname` ≠
   `larpovadatabaze.cz` as a belt-and-braces filter.
6. Save as exploration **"SEO impact — /larp/ views by session source/medium"** and
   (optionally) add it to the "SEO" collection so it shows in Reports.

Alternative one-shot **custom report** (Reports → Library → new detail report):
same dimensions/metrics, with a report filter `Page path contains /larp/`, and a
comparison on date range. Export to CSV/Google Sheets monthly.

### What "paying off" looks like

After the 02 Oct deploy, `google / organic` views of `/larp/*` should grow (or at
least stop declining) relative to `direct`, and the number of **distinct
`Page path` values** under `/larp/` opened via organic sessions should rise — the
sitemap's 1 634 game URLs are only useful if Google crawls and ranks them.

Caveat: GA4 has **no pageview history before the tag went live**, so the "before"
period in GA4 only exists from whenever `G-SNW4QBGSLW` shipped. For anything
older, the nginx access log is the only source (see below).

## Log-based before/after baseline (window 18 Oct – 1 Nov 2026)

From the site-usage audit (access log + prod DB), the deploy cut crawler load and
left search inflow intact — the table to quote when re-running this check:

| Crawler family | before (per day) | after (per day) |
|---|---|---|
| ExaSearchBot | 28 220 | 414 |
| AIWebIndex | 25 421 | 0 |
| MJ12bot | 1 521 | 7 |
| Claudebot | 916 | 394 |
| Applebot | 1 280 | 447 |
| **AhrefsBot** | 15 320 | **27 855** (still not disallowed — verified live 2026-11-01: robots.txt has no AhrefsBot/PetalBot entry, only the `Sitemap:` line) |
| PetalBot | — | top family after the cut (a Disallow entry is a request, not a guarantee — verify per-family volume after any robots change) |
| total crawler/day | ~43 k | 6.5–9.9 k |

External referrers in the window: **Google already #1 with 291 requests** — the
organic channel exists; the GA4 exploration above is what ties it to game views.

## Re-running this check monthly

1. `curl -s -o /dev/null -w '%{http_code} %{size_download}\n' https://larpovadatabaze.cz/sitemap.xml`
   and `grep -c '/larp/'` on the body — expect 200 and the game count to grow with
   `csld_game` (currently 1 634 of ~4 400 URLs).
2. `curl -s https://larpovadatabaze.cz/robots.txt` — confirm the `Sitemap:` line
   and re-check the bot Disallow list per family (AhrefsBot/PetalBot were NOT in
   it as of 2026-11-01 — verify live, don't trust the file).
3. In GA4, open the saved exploration, extend the "after" date range to today,
   compare against the Sep baseline — record `google / organic` views of `/larp/*`
   and distinct game paths opened.
4. Optionally re-run the access-log aggregation
   (`site-usage-audit` skill, `scripts/audit_access_log.py`) over the new window to
   refresh the crawler table and the referrer ranking.
5. File the numbers in the wiki (wiki-larpdb) under the audit docs.
