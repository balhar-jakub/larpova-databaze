#!/usr/bin/env node
/**
 * Coverage ratchet (Phase 4).
 *
 * A drop in per-file coverage is a regression like a red test: coverage can
 * only be *regained* deliberately (a PR that raises the floor), never
 * silently lost (a PR that deletes a probe to make the suite green).
 *
 * How it works:
 * - scripts/coverage-ratchet-baseline.json holds per-file line-coverage
 *   floors, generated from the current main (see the workflow and
 *   "Raising the floors" below).
 * - This script runs a jest coverage pass (API + web suites) and fails if
 *   ANY file drops even 1 point below its floor. Files not in the baseline
 *   are NOT required to have coverage — new files enter the baseline at
 *   their merged coverage the next time the baseline is refreshed.
 *
 * Refreshing the baseline (only on a green main, never to "fix" a red one):
 *   node scripts/coverage-ratchet.mjs --update-baseline
 *   # review the diff — floors must only go UP per file (or gain files)
 *
 * Design notes:
 * - Lines, not branches: branch floors churn on refactors that merge two
 *   if-arms, and the audit's regression classes (a deleted probe, an
 *   untested resolver body) all show up as lost lines first.
 * - Whole-percentage floors (no decimals): a 79.99→79.5 wobble must not
 *   fail a PR; only real regressions do.
 * - The API suite and the web suite run in one process each, the same way
 *   CI runs them, so the numbers match what a PR sees.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'coverage-ratchet-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

/**
 * Collect per-file LINE coverage for a jest config.
 * Returns { [absPath]: pct }.
 */
function collectCoverage(jestArgs, label) {
  let out;
  try {
    out = execFileSync(
      process.execPath,
      [
        '--experimental-vm-modules',
        join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js'),
        ...jestArgs,
        // One worker: the suite-heavy API run under coverage spawns several
        // instrumented workers at once and the 2-core runner OOM-kills the
        // tree mid-run (the step dies with no failure summary and no ratchet
        // print). Serial is slower per run but deterministic — a ratchet's
        // whole job is determinism.
        '--runInBand',
        '--coverage',
        '--coverageReporters=json-summary',
      ],
      { cwd: join(ROOT, 'packages', 'web'), encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    // execFileSync throws on a non-zero exit — and jest's failure summary lives
    // in the swallowed stdout (tens of MB with coverage tables; the summary is
    // at the end). Surface the tail or the step fails with no diagnosis.
    const out = typeof err?.stdout === 'string' ? err.stdout : '';
    console.error(`coverage ratchet: the ${label} jest run failed. Output tail:`);
    console.error(out.slice(-20_000) || err.message);
    throw err;
  }

  const summaryPath = join(ROOT, 'packages', 'web', 'coverage', 'coverage-summary.json');
  if (!existsSync(summaryPath)) {
    console.error(`coverage ratchet: no coverage summary produced for the ${label} suite`);
    process.exit(1);
  }
  const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
  const files = {};
  for (const [path, data] of Object.entries(summary)) {
    if (path === 'total') continue;
    files[path] = data.lines.pct;
  }
  return files;
}

function main() {
  // The same invocation CI uses, so the floors are what a PR actually sees.
  const api = collectCoverage(
    ['--config', 'jest.api.config.json', '--collectCoverageFrom=src/api/src/**/*.ts', '--collectCoverageFrom=!src/api/src/**/*.d.ts', 'src/api/src/__tests__'],
    'API',
  );
  const web = collectCoverage(
    ['--config', 'jest.config.json', '--collectCoverageFrom=src/lib/**/*.ts*', 'src/lib', 'src/components'],
    'web',
  );

  const current = { ...api, ...web };

  if (UPDATE) {
    // Baselines are written as repo-relative paths so they survive checkouts
    // at different absolute locations.
    const relative = {};
    for (const [path, pct] of Object.entries(current)) {
      relative[path.replace(/^.*\/packages\/web\//, 'packages/web/')] = pct;
    }
    const sorted = Object.fromEntries(Object.entries(relative).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
    const floorFiles = Object.keys(sorted).length;
    console.log(`coverage ratchet: baseline written (${floorFiles} files)`);
    console.log('Review the diff — floors must only go UP, never down.');
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('coverage ratchet: baseline missing — run with --update-baseline on a green main');
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));

  const failures = [];
  for (const [relPath, floorRaw] of Object.entries(baseline)) {
    const floor = Math.floor(Number(floorRaw)); // whole-% floors: wobble-tolerant
    const absPath = join(ROOT, relPath);
    const pct = current[absPath];
    if (pct === undefined) {
      // The file moved or was deleted — not a coverage regression, but worth
      // flagging so the baseline gets refreshed consciously.
      console.warn(`coverage ratchet: ${relPath} not covered by this run (moved/deleted?) — baseline needs a refresh`);
      continue;
    }
    if (Math.floor(pct) < floor) {
      failures.push({ relPath, floor, pct });
    }
  }

  if (failures.length > 0) {
    console.error('\ncoverage ratchet: per-file line coverage DROPPED below the floor:');
    for (const f of failures) {
      console.error(`  ${f.relPath}: ${Math.floor(f.pct)}% < floor ${f.floor}%`);
    }
    console.error('\nA coverage drop is a regression: a probe was deleted or a code path lost its test.');
    console.error('Fix the coverage in this PR, or (if the file shrank legitimately) refresh the baseline');
    console.error('in a separate, reviewed change: node scripts/coverage-ratchet.mjs --update-baseline');
    process.exit(1);
  }

  const checked = Object.keys(baseline).length;
  console.log(`coverage ratchet: OK — ${checked} files at or above their floors`);
}

main();
