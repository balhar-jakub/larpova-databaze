# Coverage: how to run it, how the ratchet works

> Practical companion to `docs/coverage-95-plan.md` (the phase plan).
> Current state: **API tree 95.82%**, **UI tree 95.94%** line coverage,
> locked per-file by the coverage ratchet.

## Running coverage locally

From the repo root (monorepo, Yarn 1):

```bash
# UI suite (jsdom, no database needed)
cd packages/web
TZ=Europe/Prague NODE_OPTIONS=--experimental-vm-modules \
  ../../node_modules/jest/bin/jest.js --coverage \
  --coverageReporters=json-summary --coverageReporters=text-summary

# API suite (integration tests — needs a live Postgres with the
# migrated schema; the local seeded one is fine)
cd packages/web
DATABASE_URL="postgresql://csld:...@localhost:5433/csld" \
TZ=Europe/Prague NODE_OPTIONS=--experimental-vm-modules \
  ../../node_modules/jest/bin/jest.js --config jest.api.config.json \
  --coverage --coverageReporters=json-summary --coverageReporters=text-summary
```

- `TZ=Europe/Prague` matters: dates are formatted and parsed without an
  explicit timezone in several code paths; a different TZ changes which
  branch runs and can flip results at day boundaries.
- The UI percentage printed here counts the **whole tree** because
  `jest.config.json` has an honest `collectCoverageFrom` (Phase 0).
  Files never imported by a test still count in the denominator.
- Agreed exclusions from the denominator (they do NOT count against
  you): `*.stories.tsx`, `src/utils/gtag.ts`,
  `src/components/componentTestIds.ts`, `src/graphql/__generated__/**`.
- To find your remaining lines in a file:

```bash
cd packages/web
TZ=Europe/Prague NODE_OPTIONS=--experimental-vm-modules \
  ../../node_modules/jest/bin/jest.js <test file> \
  --coverage --collectCoverageFrom='<the source file>' \
  --coverageReporters=json
# uncovered statement lines: coverage/coverage-final.json -> statementMap/s
```

## The coverage ratchet

`scripts/coverage-ratchet.mjs` runs BOTH jest suites with coverage
(same invocation CI uses) and fails if **any file** drops below its
per-file line-coverage floor recorded in
`scripts/coverage-ratchet-baseline.json` (240 files today, avg floor
94.1%).

- A coverage drop is a regression like a red test: someone deleted a
  probe or an untested path regained lines. The build goes red.
- Floors are whole percentages (no decimals) so a 79.99→79.5 wobble
  never fails a PR; only real regressions do.
- Floors never go down. New files enter the baseline at their merged
  coverage the next time the baseline is refreshed.
- The API run needs `DATABASE_URL`; CI uses a fresh migrated,
  zero-seed postgres — floors must hold in that environment, so don't
  calibrate them against the seeded local DB for data-dependent files.
- Known data-dependent floors (calibrated to CI's empty database, so the
  floor reflects what the empty-DB run can reach, not the seeded DB's
  higher numbers): `resolvers/homepage.ts` (99, not 100) and
  `scheduled/similarityEngine.ts` (90, not 96) — a seeded-DB branch
  (e.g. similarity work only when games exist) is unreachable in CI.

### When and how to refresh the baseline

Only on a **green main**, never to "fix" a red build:

```bash
DATABASE_URL="postgresql://...@localhost:5433/csld" \
TZ=Europe/Prague NODE_OPTIONS=--experimental-vm-modules \
  node scripts/coverage-ratchet.mjs --update-baseline
git diff scripts/coverage-ratchet-baseline.json   # review the diff
```

Review the diff: floors must only go UP per file (or gain files).
A floor that went down means coverage was lost — restore the test or
consciously accept the drop in a reviewed change with a stated reason.

### CI wiring

`.github/workflows/test.yml` (Node 22 + Node 26 matrix, fresh
postgres:16) runs the ratchet as the last step of every PR and every
push to main. It prints per-suite coverage summary lines
(`coverage summary (API/UI): lines …% (covered/total)`) so the totals
are visible in the job log without downloading artifacts.

## Branch coverage

The ≥90% branch goal has its own plan (`docs/coverage-branch-90-plan.md`) and
its own baseline (`scripts/coverage-ratchet-branch-baseline.json`) — it is
NOT bolted onto the line baseline. The same ratchet call enforces both:

- **Per-file floors = lines** (unchanged, above).
- **Suite-level branch gate**: the branch baseline's `targets` (API, web)
  hold each suite's overall branch % floor. A suite below its target fails
  the PR with `SUITE branch coverage DROPPED below its floor`. Targets start
  at the measured state (API 77%, web 82%, calibrated on an empty migrated
  DB — the same environment CI runs) and are raised with each coverage
  batch of the branch plan until they reach 90.
- **Per-file branch numbers** are recorded in the same file for progress
  tracking and printed as `branch drift` warnings (informational, 1-point
  wobble tolerance, never fail a PR) — per-file branch floors churn on
  innocent refactors, suite totals do not.
- Refresh: `node scripts/coverage-ratchet.mjs --update-baseline` writes
  BOTH baselines; review the diff (line floors only up, suite targets only
  up, per-file branch numbers informative).
