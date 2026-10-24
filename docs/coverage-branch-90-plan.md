# Plan: ≥90% Branch Coverage — API + UI

> Companion to `docs/coverage-95-plan.md` (line coverage 95%+ is done and locked).
> Branch coverage was explicitly deferred there ("a branch target, if ever wanted,
> gets its own plan and baseline" — `docs/coverage-howto.md`). This is that plan.
> Generated 2026-10-26 from real jest coverage runs on main tip (`69ef0053`,
> suite-identical to `719cdf36`): UI suite 925 tests green, API suite 537 tests
> green. All numbers below are **measured** (`coverage-summary.json`, branches).

## Goal

**≥90% branch coverage on each suite separately** (same convention as the line
plan — never a blended number):

| Suite | Branches covered | Denominator | Coverage | Arms to 90% |
|---|---|---|---|---|
| UI (`jest.config.json`, honest `collectCoverageFrom`) | 3,501 | 4,265 | **82.08%** | **+338** |
| API (`jest.api.config.json`) | 1,800 | 2,280 | **78.94%** | **+252** |

Combined (informational): 81.02% (5,301/6,545), gap 638 arms.

Two facts from the measurement that shape the whole plan:

- **The gap is highly concentrated.** The top 17 UI files carry 342 uncovered
  arms (≥ the 338 needed); the top 6 API files carry 255 (≥ the 252 needed).
  We do NOT need to touch all 157/49 branch-bearing files — but we work in
  committed batches per the line plan, and the long tail is picked off at the
  end only where the headline still says <90%.
- **Most uncovered arms are not "untested features" — they are the null/false
  side of fallbacks and guards.** API: snake_case↔camelCase fallback resolvers
  and the reject-side of authz/input guards. UI: `??`/`&&`/`?:` in JSX whose
  test fixtures always supplied the happy value (an optional prop present, a
  list non-empty). So the dominant test pattern of this plan is **render/resolve
  with data MISSING what the fixtures always had**, plus guard matrices — not
  new interaction tests.

### Arm-triage rule (new vs the line plan)

Not every uncovered arm deserves a test. Per `csld-local-verification`: a branch
that cannot execute is a code smell, not a test gap. Every batch classifies its
arms:

1. **Testable** → write the test (the default).
2. **Unreachable/defensive** (`?? fallback` on a column Prisma types NOT NULL, a
   `?? 1` role fallback that GraphQL enum validation makes unreachable, dead
   default arms) → **simplify the code in the same PR** (drop the arm or assert
   the invariant), stated in the commit message — a test that cannot reach the
   arm measures nothing.
3. **Data-dependent** (seeded-DB-only paths, e.g. similarity work only when
   games exist) → cover on the local seeded DB but **calibrate the ratchet
   floor to CI's empty database**, exactly like `homepage.ts`/`similarityEngine.ts`
   in the line baseline.

---

## Phase 0 — Branch ratchet infrastructure (~1 day) — ✅ DONE (PR pending, branch `chore/branch-coverage-90-phase0`)

Measured on the CI-equivalent environment (throwaway migrated DB, zero seed):
**API 77.02%** branches (1781/2295 in one run; wobbles ±5 arms run-to-run on
`larpCzImport`), **web 82.08%** (3501/4265). The seeded dev DB reads higher
(API 78.94%) — data-dependent files measure lower on the empty DB; floors are
calibrated to CI's environment, never the seeded one (the line baseline's
precedent).

- [x] **0.1** `scripts/coverage-ratchet.mjs` now collects `branches.pct` for
  every file alongside lines, and prints
  `coverage summary (API|web): branches P% (covered/total)` next to the lines
  summary — same run, same coverage pass.
- [x] **0.2** `scripts/coverage-ratchet-branch-baseline.json` (repo-relative
  paths, whole-percent values): suite-level `targets` (the gate) + per-file
  `files` (informational progress tracking). The line baseline
  (`scripts/coverage-ratchet-baseline.json`) is untouched — floors never
  moved (one attempted refresh showed 3 files up on a flaky measurement;
  reverted: the reproducible values match the committed floors exactly).
- [x] **0.3 Gate design (decided):** **suite-level branch gate** — each
  suite's overall branch % must hold its `targets` floor (API 77, web 82
  today, raised with each coverage batch until 90). Per-file branch numbers
  stay informational (drift warnings with 1-point wobble tolerance, never
  failing a PR): branch floors churn on innocent refactors (two if-arms
  merged into one, an extraction), while a suite total is refactor-stable —
  merging two arms removes one from BOTH numerator and denominator, so the
  number only moves when coverage genuinely changes.
- [x] **0.4** Baseline recorded from a real ratchet run on the throwaway
  migrated DB (`csld_ratchet`, dropped after): API 538/538 tests green, web
  925/925 green. Verified: check mode green (`OK — 240 files at or above
  their floors`, exit 0) and the gate's RED-check — a sabotaged target
  (API floor 78 while measuring 77) fails with
  `SUITE branch coverage DROPPED below its floor: API: 77% < floor 78%`,
  exit 1.
- [x] **0.5** CI: no workflow change needed — `test.yml` already runs
  `node scripts/coverage-ratchet.mjs` as the last step; the branch baseline
  is read by the same call. (The step's comment text was updated to mention
  both baselines.)

**Exit criteria:** ratchet check passes with the branch baseline on green
main; CI prints both summary lines; a deliberate branch drop goes red. ✅ verified locally on the CI-equivalent DB; CI confirms on the PR itself.

---

## Phase 1 — API: 78.94% → 90% (+252 arms, ~1–2 weeks) — DONE ✅

Reached on branch `chore/branch-coverage-90-phase1` (190 commits):
API branch 90.08% (2,045/2,270) on the ratchet DB, 90.17% (2,038/2,260)
on the seeded dev DB — 73 suites / 712 tests green on BOTH (the exit
criteria's two-database demand; seven suites had asserts that assumed a
small database and were made data-independent). Note for any seeded
environment: the 2014 import left six id sequences behind their max ids
(game/image/label/photo/video/donation) — implicit-id inserts collide
until the sequences are setval'd to max(id). The
suite-level gate is live in CI (`scripts/coverage-ratchet.mjs`, targets
API 90 / web 82, exit-verified locally); `src/api/src/index.ts` (the
server bootstrap) is excluded from the API scope for the same reason
`server.ts` is on the web side. The arm-triage also simplified genuinely
unreachable code (e.g. the dropped `registration_open` fallback) instead
of fake-testing it, and the stale web test pinning that dead fallback was
updated to the current contract.

Ordered by arm count; batches of 3–6 files, each committed green with tests +
`tsc --noEmit`, per the line plan's batch discipline. Extend existing suites
where they exist (`gameCoverImage.test.ts`, `gameFieldResolvers.test.ts`, …)
rather than opening new files.

### 1A. `resolvers/gameMutation.ts` — 77 arms (the single biggest file)
- [ ] Guard matrix per mutation (anonymous / USER-not-author / author /
  editor / admin) — the reject arms of every `gamePermissions` check.
- [ ] Input-validation arms (empty/oversized/invalid fields per mutation).
- [ ] Cover-image and file-bearing arms (real `LocalFiles` tmp dir).
- [ ] `?? 1`-style and enum-fallback arms → arm-triage (2): GraphQL enum
  validation fires first; simplify, don't fake-test.

### 1B. `resolvers/index.ts` — 62 arms
- [ ] Field-resolver fallback matrix, one test per resolver, feeding raw rows
  with only snake_case, only camelCase, and neither: `registrationUrl`,
  `registrationOpen` (incl. legacy `registration_open` column),
  `registrationStatus`, `registrationOpensAt` (UPCOMING + missing
  `registration_opens_at`), `Label.isRequired`/`isAuthorized`, the
  `RecommendedEvent` copies.
- [ ] `User.commentsPaged` guard arms: string-vs-number id, `!userId`/NaN,
  editor visibility vs deleted/hidden game filtering, `offset`/`limit`
  fallbacks, `amount_of_upvotes` null.
- [ ] `Event.allowedActions` / `Game.allowedActions` reject arms (anonymous,
  non-editor non-author, NaN id).

### 1C. `resolvers/search.ts` — 32 arms
- [ ] Filter/sort permutation arms (with/without each optional input),
  typo-suggestion branches, empty-result arms. Mostly extend
  `searchQueries`-owned suites; **data-dependent — calibrate floor to CI**.

### 1D. `resolvers/eventMutation.ts` — 31 arms
- [ ] Registration input guards (extend `eventRegistration.test.ts`),
  permission reject arms, child-cleanup arms on delete.

### 1E. `resolvers/homepage.ts` — 30 arms
- [ ] Panel-present/empty arms per block. **Data-dependent — the line baseline
  already carries its 99-not-100 CI calibration; measure branch arms on the
  throwaway migrated DB before setting the floor.**

### 1F. `resolvers/series.ts` — 23 arms, `resolvers/yearReview.ts` — 23 arms
- [ ] `normalizeSeries`: null row, empty instalments, missing/`null` years,
  non-Date `added`, deleted-series + editor visibility.
- [ ] yearReview: per-band empty arms, missing-ratings arms, boundary years.

### 1G. `external/larpyCzArticlesImport.ts` — 23, `auth/googleRoutes.ts` — 21
- [ ] Importer: rate-limit/backoff arms, malformed-row skip arms (per
  `references/fetch-stub-importer-tests.md`), FK-swallow arms.
- [ ] googleRoutes: exchange failure, unverified e-mail, state-mismatch,
  persisted-identity arms (extend the supertest suite).

### 1H. Remaining files to close the headline — ~100 arms across ~20 files
- [ ] `game.ts` 22 (nested-list guard arms), `event.ts` 13, `gameCatalog.ts` 12
  (order/filter arms), `stats.ts` 12, `profilePicture.ts` 11, `userMutation.ts`
  10, `googleCalendar.ts` 8, `googleLink.ts` 7 (unique-violation race), `article.ts`
  6, `larpCzImport.ts` 6, `fileService.ts` 6, then ≤4-arm files
  (`larpCzArticlesImport` 4, `appUsers` 4, `gamePermissions` 4,
  `imageStrategies` 4, `mappers` 3, `similarityEngine` 3, `group` 3, `user` 2,
  `textUtils` 2, `rememberMe` 2, `urlUtils` 2, …) only as far as the headline
  needs; each batch runs the arm-triage so defensive arms get simplified, not
  tested.

**Exit criteria:** API branch ≥90% (≈2,052/2,280) measured with the standard
command on a throwaway migrated DB AND the seeded dev DB; all 537+ tests green;
branch ratchet floors raised for every touched file.

---

## Phase 2 — UI: 82.08% → 90% (+338 arms, ~2–3 weeks)

The dominant pattern: **render with the optional data absent** (null user,
empty list, missing optional prop, failed query) — the arms are the fallback
side the existing happy-path fixtures never take. Batches by area, biggest gap
first; per-file numbers are measured uncovered arms.

### 2A. HomePage area — 104 arms / 17 files
- [ ] `HomePagePanel.tsx` 32 (32/160, 80.00%): panel-visible/feature-flag arms,
  empty-block states.
- [ ] `YearReviewPanel.tsx` 32 (71.42%): per-section empty/zero arms, year
  switch fallbacks.
- [ ] `HomeToFinishPanel.tsx` 14 (63.15%), `BaseCommentPanel.tsx` 12 (75%),
  `HomeRecommendedPanel.tsx` 11 (65.62%), remaining 11 files (~33 arms):
  empty-state and null-guard arms.

### 2B. common — 96 arms / 26 files
- [ ] `HeaderSearchForm.tsx` 13 (80.59%): debounce/suggestion/empty arms.
- [ ] `FormDateInputField.tsx` 14 (48.14% — the worst-ratio file): invalid
  date, empty, parse-fallback arms.
- [ ] `FormRichTextInputField.tsx` 9, `FormAutoCompleteField.tsx` ~5,
  `PageHeader/HeaderUser` avatar/anonymous arms, `CookieConsent`,
  `SignInRequiredWrapper`, `LabelEditModal`, remaining small files to 90.

### 2C. GameEdit — 70 arms / 6 files
- [ ] `GameEditForm.tsx` 27 (66.25%), `GameEditPagePanel.tsx` 25 (62.12%),
  `SeriesAutoCompleteField.tsx` 10, `AuthorsAutoCompleteField.tsx` 5,
  `NewAuthorModal`, `form` utils arms.

### 2D. Search — 63 arms / 10 files
- [ ] `SearchPanel.tsx` 20 (81.98%), `SearchEventRow.tsx` 9 (72.72%),
  remaining 8 files ~34 arms (empty results, tab fallbacks, optional-prop arms).

### 2E. Calendar — 62 arms / 8 files
- [ ] `CalendarPanel.tsx` 25 (84.56%), `calendarUtils.ts` 16 (85.84%),
  `CalendarEventCard.tsx` 11 (78.43%), `WeekendAgenda`/`MonthGrid`/
  `SeasonStrip`/`calendarState` remaining arms.

### 2F. GameDetail — 60 arms / 9 files
- [ ] `GameDetailPanel.tsx` 20 (69.23%), `GamePagedCommentsPanel.tsx` 14
  (80.28%), `GameRatingPanel.tsx` 11 (84.28%), `GameHeaderPanel.tsx` 5,
  remaining files (missing-cover, no-ratings, disabled-ratings arms).

### 2G. Profile — 43, Catalog — 42, EventEdit — 42, Admin — 36
- [ ] `UserDetailPanel` 10 + `UserSettingsPanel` 9 + remaining Profile files.
- [ ] `CatalogFilterPanel.tsx` 20 (82.30%) + `catalogState.ts` 14 (90.96%):
  filter-clear, chip-remove, boundary-year arms.
- [ ] `EventEditPanel.tsx` 18 (63.26%) + `EventEdit/formUtils.ts` 11 (89.21%).
- [ ] `AdminLabelsPanel.tsx` 17 (74.62%) + remaining Admin panels (confirm
  dialogs, empty lists).

### 2H. Long tail (~120 arms) — only as far as the headline needs
- [ ] `EventDetailPanel.tsx` 17, `AllCommentsPanel.tsx` 17,
  `GroupDetailPanel.tsx` 10, `sanitizeHtml.ts` 10 (XSS-vector arms — keep the
  existing vector list in sync), hooks/context/`with/apolloClient`/lib/SignIn/
  SignUp/Statistics/RecoverPassword ~65 arms.

**Exit criteria:** UI branch ≥90% (≈3,839/4,265) with the Phase-0 honest
`collectCoverageFrom`; all 925+ tests green; branch floors raised per touched
file.

---

## Phase 3 — Lock it in (~1 day)

- [ ] Final baseline refresh on green main: every branch floor ≥90% except the
  consciously-calibrated data-dependent files (documented per file, the line
  baseline's precedent).
- [ ] CI enforces the suite-level 90 branch gate + per-file branch floors
  (Phase 0 wiring goes from informational to enforcing).
- [ ] `docs/coverage-howto.md`: replace the "out of scope" branch section with
  the new commands, ratchet mechanics, and the arm-triage rule.
- [ ] Tick all boxes here; state the final numbers in the last commit message
  (e.g. `branch 78.94→90.4% API, 82.08→90.6% UI`).

---

## Measurement & verification commands (unchanged from the howto)

```bash
# UI — branches are in the same summary
cd packages/web && TZ=Europe/Prague NODE_OPTIONS=--experimental-vm-modules \
  ../../node_modules/jest/bin/jest.js --coverage \
  --coverageReporters=json-summary --coverageReporters=text-summary

# API (runInBand under coverage — parallel workers deadlock on the shared DB)
cd packages/web && DATABASE_URL=… TZ=Europe/Prague \
  NODE_OPTIONS=--experimental-vm-modules \
  ../../node_modules/jest/bin/jest.js --config jest.api.config.json \
  src/api/src/__tests__ --coverage --coverageReporters=json-summary --runInBand
```

Per-file arm location: `--coverageReporters=json` → `coverage-final.json` →
`branchMap` + `b` (entries with a zero arm are the uncovered ones, with exact
line numbers — this plan's per-file numbers were produced exactly that way).

CI (fresh empty postgres) is the authority for data-dependent files; calibrate
their floors there, never against the seeded dev DB.

## Effort estimate

| Phase | Scope | Est. |
|---|---|---|
| 0 | Ratchet branch support + baseline + gate | ~1 day |
| 1 | API +252 arms (top 6 files carry 255) | 1–2 weeks |
| 2 | UI +338 arms (top 17 files carry 342) | 2–3 weeks |
| 3 | Enforce + docs | ~1 day |

Tracking: tick the boxes; after each batch, re-run coverage, raise the touched
files' branch floors, and re-read the arm ranking (`coverage-final.json`) —
each batch reshuffles the remainder.
