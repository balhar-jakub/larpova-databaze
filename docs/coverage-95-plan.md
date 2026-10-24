# Plan: 95% Line Coverage — API + UI

> Generated 2026-10-24 from real jest coverage runs on `ac821093` (origin/main tip).
> All numbers are measured, not estimated. Suites: UI (`jest.config.json`, jsdom) and
> API (`jest.api.config.json`, integration against live Postgres).

## Baseline (measured)

| Suite | Lines covered | Denominator | Coverage | Gap to 95% |
|---|---|---|---|---|
| API tree (`src/api/**`) | 1,730 | 2,110 | **82.0%** | **+274 lines** |
| UI tree (`src/**` excl. `api/`) | 1,829 | 4,045 | **45.2%** | **+2,014 lines** |

**Status after Phase 0 (branch `chore/coverage-95-phase0`):** honest UI baseline is now
**47.3% (1,817/3,844)** with the agreed exclusions applied; ratchet floors lock all 242 files.

**Important:** the UI suite's jest config has no `collectCoverageFrom`, so untested files
never enter the denominator — the previously reported "55.9%" only counted files touched
by tests. The honest UI number is **45.2%**. Fixing the measurement is Phase 0.

Goal: **≥95% line coverage on both trees**, verified with `--collectCoverageFrom`
covering the whole tree (no hiding behind the touched-files-only default), and floors
enforced by the existing coverage ratchet so coverage can never silently regress.

---

## Phase 0 — Fix measurement infrastructure (prerequisite, ~1–2 days) — ✅ DONE (branch `chore/coverage-95-phase0`)

- [x] **0.1** Add `collectCoverageFrom` to `packages/web/jest.config.json`:
      `["src/**/*.ts", "src/**/*.tsx", "!src/api/**", "!src/graphql/__generated__/**", "!**/*.test.*", "!**/__tests__/**", "!**/tests/**", "!**/*.stories.tsx"]`
      — this is what makes "95%" a well-defined, honest number.
- [x] **0.2** Fix the 5 cross-config suite failures found during measurement:
  - `src/api/services/HttpService.test.ts` + `LoggingService.test.ts` — RESOLVED by
    deleting the legacy `src/api/services/` layer: it was dead client-side code
    (the `proxy` base no longer exists) used only by `ErrorBoundary`, which now
    posts directly to the existing `pages/api/log.ts` route (`reportErrorToServer`).
  - `src/components/EventEdit/formUtils.test.ts`, `src/utils/tests/graphqlUtils.test.ts`,
    `src/utils/tests/sanitizeHtml.test.ts` — RESOLVED by `testPathIgnorePatterns` in
    `jest.api.config.json` so the API config owns only its own tree.
- [x] **0.3** Agreed exclusions (keep the denominator honest but fair):
  - `*.stories.tsx` (Storybook files are demos, not product code) — 2 files, ~39 lines
  - `src/utils/gtag.ts` (analytics shim, side-effect-only) — ~40 lines
  - `src/components/componentTestIds.ts` (test infrastructure, not product code) — ~29 lines
  - `src/graphql/__generated__/**` (generated)
  Everything else counts. If you'd rather test gtag/stories instead of excluding,
  delete the exclusion line — the checklist below then covers them too.
- [x] **0.4** Extend the coverage ratchet to the UI tree: single baseline regenerated
      with the honest denominator — **54 → 242 files** (53 API + 189 UI), zero floors
      went DOWN, zero files lost. Ratchet check passes: `OK — 242 files at or above their floors`.
- [x] **0.5** CI: ratchet step unchanged in test.yml — it now enforces all 242 floors
      automatically because the baseline file is the input. (The ratchet script's web
      invocation was updated to mirror the new `collectCoverageFrom`.)

**Exit criteria:** `yarn test --coverage` reports one honest total per suite; all suites
green in CI; ratchet runs for both trees.

---

## Phase 1 — API: 82% → 95% (+274 lines, ~1–2 weeks)

Gap is concentrated in `external/` (importers) and a handful of resolvers. Ordered by gap:

### 1A. External article/game importers — 185 lines (the big chunk)
- [ ] `src/api/src/external/larpCzArticlesImport.ts` — 76/82 lines to cover (7%). HTTP fetch + HTML/JSON parsing; mock `fetch` with fixture payloads (happy path, malformed HTML, network error, empty list).
- [ ] `src/api/src/external/larpyCzArticlesImport.ts` — 55/60 lines (8%). Same mock-fetch pattern.
- [ ] `src/api/src/external/larpCzImport.ts` — 54/55 lines (2%). Same pattern.
- [ ] While here: `external/googleCalendar.ts` 35→(4 missing), `external/recaptcha.ts` (2 missing) — trivial add-ons.

### 1B. Auth — 37 lines
- [ ] `src/api/src/auth/googleRoutes.ts` — 32/72 lines (56%): cover the OAuth redirect/callback branches, error paths (denied consent, state mismatch).
- [ ] `src/api/src/auth/googleLink.ts` — 5 lines missing (link/unlink edge cases).

### 1C. Resolvers — ~90 lines spread over many files
- [ ] `resolvers/game.ts` — 27/48 lines (44%): per-field branches.
- [ ] `resolvers/gameMutation.ts` — 22/187 (88%): remaining error/permission branches.
- [ ] `resolvers/search.ts` — 14/242 (94%): last filter combinations.
- [ ] `resolvers/index.ts` — 5 lines (unmapped fields).
- [ ] `resolvers/group.ts` — 8/8 (0%): no dedicated tests at all; add resolver-level tests (fixtures exist via `csld_csld_group`).
- [ ] `resolvers/profilePicture.ts` — 6 lines (84%).
- [ ] `resolvers/eventMutation.ts` — 9/96 (91%); `resolvers/gameCatalog.ts` — 7/112; `resolvers/article.ts` + `event.ts` + `yearReview.ts` — 3 each; `resolvers/mappers.ts` — 2.

### 1D. Files & scheduled — 39 lines
- [ ] `src/api/src/files/fileService.ts` — 14/63 (78%): error branches (bad mime, size limit, write failure).
- [ ] `src/api/src/files/imageStrategies.ts` — 3 missing.
- [ ] `src/api/src/scheduled/tasks.ts` — 11/22 (50%): cron registration/trigger branches.
- [ ] `src/api/src/scheduled/similarityEngine.ts` — 7/54 (87%).

### 1E. Close-out
- [ ] Update ratchet baseline: all API files floor ≥95% (`node scripts/coverage-ratchet.mjs --update-baseline`, review floors only went UP).
- [ ] Verify: `yarn test:api --coverage` total ≥95% lines on `src/api/**`.

**Exit criteria:** API line coverage ≥95%, ratchet floors ≥95% for every API file.

---

## Phase 2 — UI: 45% → 95% (+~1,940 lines, the main effort, ~4–6 weeks)

Ordered by area gap. Each item = one or more `*.test.tsx` files colocated with the
component (the repo's existing pattern). Suggested order = cheapest wins first within
each area, areas ordered by gap size.

### 2A. common — gap 528 lines
- [ ] `HeaderSearchForm.tsx` (52 lines, 13%) — submit/autocomplete branches.
- [ ] `form/FormRichTextInputField.tsx` (51, 0%) + `form/richTextInputUtils.ts` (23, 0%) — pure-function utils first, then the field.
- [ ] `form/FormAutoCompleteField.tsx` (34, 0%).
- [ ] `form/FormDateInputField.tsx` (22, 0%).
- [ ] `form/FormFileInputField.tsx` (15, 42% → rest).
- [ ] `PageHeader/HeaderUser.tsx` (38, 0%) — signed-in/signed-out/avatar states.
- [ ] `CookieConsent/CookieConsent.tsx` (23, 0%).
- [ ] `SignInRequiredWrapper/SignInRequiredWrapper.tsx` (21, 0%).
- [ ] `LabelEditmodal/LabelEditModal.tsx` (14, 7%).
- [ ] Remaining `common/**` files to 95% (≈150 lines across many small files — sweep with a coverage report per file after the items above).

### 2B. Calendar — gap 266 lines
- [ ] `CalendarPanel.tsx` (161, 0%) — the single biggest file; smoke test + navigation + month-switch branches.
- [ ] `HistoryView.tsx` (28, 0%), `WeekendAgenda.tsx` (25, 0%), `MonthGrid.tsx` (19, 0%).
- [ ] `calendarUtils.ts` already 93% (12 missing) — finish it.
- [ ] Remaining Calendar files to 95%.

### 2C. Admin — gap 164 lines (0% today)
- [ ] `AdminLabelsPanel.tsx` (61), `AdminUsersPanel.tsx` (60), `AdminTabs.tsx` (18) + remaining files.

### 2D. GameDetail — gap 146 lines
- [ ] `GamePagedCommentsPanel.tsx` (39, 0%), `GameRatingPanel.tsx` (23, 0%), `GameHeaderPanel.tsx` (19, 0%), `GameDetailPanel.tsx` (12 of 53 missing), remaining files.

### 2E. Search — gap 132 lines
- [ ] `SearchPanel.tsx` (19 of 77 missing, 75% → 95).
- [ ] `EventsSearchPanel.tsx` (24, 0%), `GroupsSearchPanel.tsx` (18, 0%), `UserSearchPanel.tsx` (18, 0%), remaining files.

### 2F. GameEdit — gap 122 lines
- [ ] `GameEditForm.tsx` (26 of 59 missing), `NewAuthorModal.tsx` (28, 0%), `GameEditPagePanel.tsx` (22, 0%), `AuthorsAutoCompleteField.tsx` (19, 0%), `GroupsAutoCompleteField.tsx` (19, 0%), remaining files.

### 2G. Profile — gap 119 lines (7% today)
- [ ] `UserSettingsPanel.tsx` (33, 0%), `ChangePasswordPanel.tsx` (28, 0%), remaining files (existing tests cover some utils).

### 2H. EventEdit / EventDetail — gap 136 lines
- [ ] `EventEditPanel.tsx` (37, 0%), `EventEditForm.tsx` (35, 0%), `EventDetailPanel.tsx` (35, 0%), `formUtils.ts` (14 of 64 missing).

### 2I. Hooks, utils, context, with — gap 222 lines
- [ ] `hooks/useRoutes.ts` (30 of 45, 33%) + remaining hooks (~43 lines).
- [ ] `utils/validationUtils.ts` (17 missing), `utils/gtag.ts` → covered by exclusion decision (0.3), remaining utils ~25 lines.
- [ ] `context/**` (45 lines, 2%) — provider branches.
- [ ] `with/apolloClient.tsx` (22, 0%).

### 2J. Remaining feature areas — gap ~330 lines
- [ ] SignUp (64), YearReview (49), GroupDetail (43), RecoverPassword (42), SignIn (44), EventDetail covered in 2H, HomePage (69 → 95), Catalog (43 → 95), Comments (4), Ladders (7), `componentTestIds.ts` (15 — trivial, or exclude as test-infrastructure in 0.3).

### 2K. Close-out
- [ ] Per-file sweep: re-run coverage, pick off any file <95% (the checklist above targets the known gaps; expect ~5–10% residual stragglers).
- [ ] Update UI ratchet baseline (from 0.4): floors ≥95% per file.
- [ ] Verify: `yarn test --coverage` total ≥95% lines with the Phase-0 `collectCoverageFrom`.

**Exit criteria:** UI line coverage ≥95% honest denominator, ratchet floors ≥95%.

---

## Phase 3 — Lock it in (~1 day)

- [ ] Merge ratchet baselines into CI so every PR runs both floors (single `node scripts/coverage-ratchet.mjs` call, both baselines).
- [ ] Add a coverage summary line to the CI job output (stmts/branch/func/lines per suite) for visibility.
- [ ] Decide branch-coverage target separately (currently 47.9% UI / 70.3% API) — recommend a follow-up plan only if wanted; 95% line coverage is the agreed goal here.
- [ ] Document in `docs/`: how to run coverage locally (`yarn test --coverage`, `yarn test:api --coverage` + `DATABASE_URL`), how the ratchet works, when to refresh baselines.

---

## Effort estimate

| Phase | Scope | Est. |
|---|---|---|
| 0 | Measurement fixes + ratchet wiring | 1–2 days |
| 1 | API +274 lines | 1–2 weeks |
| 2 | UI +~1,940 lines (~45 new/extended test files) | 4–6 weeks |
| 3 | CI lock-in + docs | 1 day |

Tracking: tick the checkboxes; after each area (2A–2J), re-run coverage and update the
ratchet floor for the touched files so progress can't regress while the plan is ongoing.
