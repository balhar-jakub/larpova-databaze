#!/usr/bin/env bash
#
# csld-backup-git.sh — Daily backup of ČSLD PostgreSQL DB + user-uploaded files
#
# Writes two artifacts to a private GitHub repo (default: balhar-jakub/larpova-databaze-backup):
#   db/latest.sql.gz   — rolling gzip-compressed pg_dump, overwritten in place
#   files/<mirror>     — rsync mirror of $CSLD_DATA_DIR, in place
#
# Idempotent. Safe to run by hand or from cron.
# Designed to be retried tomorrow if today's run partially fails — git commit
# only fires when something actually changed.
#
# Required env:
#   DATABASE_URL         — PostgreSQL connection string (must be reachable, with SSL)
# Optional env (with defaults):
#   CSLD_DATA_DIR        — directory containing user files (default: /tmp/csld-files)
#   BACKUP_REPO_DIR      — local checkout of the backup repo (default: /opt/csld-backup)
#   BACKUP_REMOTE        — git remote name to push to (default: origin)
#   BACKUP_BRANCH        — branch to push to (default: main)
#   HISTORY_KEEP         — number of dated DB dumps to keep in db/history/ (default: 30)
#   PG_DUMP_EXTRA_ARGS   — extra args for pg_dump (default: empty)
#
# Exit codes:
#   0 — success (or no-op when nothing changed)
#   1 — unrecoverable error (see /var/log/csld-backup.log)

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────

CSLD_DATA_DIR="${CSLD_DATA_DIR:-/tmp/csld-files}"
BACKUP_REPO_DIR="${BACKUP_REPO_DIR:-/opt/csld-backup}"
BACKUP_REMOTE="${BACKUP_REMOTE:-origin}"
BACKUP_BRANCH="${BACKUP_BRANCH:-main}"
HISTORY_KEEP="${HISTORY_KEEP:-30}"
PG_DUMP_EXTRA_ARGS="${PG_DUMP_EXTRA_ARGS:-}"

DB_DIR="$BACKUP_REPO_DIR/db"
FILES_DIR="$BACKUP_REPO_DIR/files"
HISTORY_DIR="$DB_DIR/history"

LOG_DIR="${LOG_DIR:-/var/log}"
LOG="$LOG_DIR/csld-backup.log"

STAMP="$(date -u +%Y-%m-%dT%H-%MZ)"

# ── Helpers ──────────────────────────────────────────────────────────────────

log() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

require_env() {
  [ -n "${!1:-}" ] || die "Required env var $1 is not set"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command '$1' not found in PATH"
}

# ── Pre-flight ───────────────────────────────────────────────────────────────

mkdir -p "$LOG_DIR"
touch "$LOG"

require_env DATABASE_URL
require_cmd git
require_cmd rsync
require_cmd gzip

# ── Postgres client detection ────────────────────────────────────────────────
# Prefer the bundled PostgreSQL 18 client (matches the server version). Fall
# back to the wrapper if PG18 isn't installed. Set PG_DUMP_BIN to override.

if [ -n "${PG_DUMP_BIN:-}" ]; then
  : # user-provided path
elif [ -x /usr/lib/postgresql/18/bin/pg_dump ]; then
  PG_DUMP_BIN=/usr/lib/postgresql/18/bin/pg_dump
elif command -v pg_dump >/dev/null 2>&1; then
  PG_DUMP_BIN=$(command -v pg_dump)
else
  die "No pg_dump found. Set PG_DUMP_BIN or install postgresql-client."
fi
log "Using pg_dump: $PG_DUMP_BIN ($($PG_DUMP_BIN --version 2>&1 | head -1))"

[ -d "$BACKUP_REPO_DIR/.git" ] \
  || die "BACKUP_REPO_DIR ($BACKUP_REPO_DIR) is not a git repo. Run csld-backup-setup.sh first."

mkdir -p "$DB_DIR" "$FILES_DIR" "$HISTORY_DIR"

[ -d "$CSLD_DATA_DIR" ] \
  || log "WARNING: CSLD_DATA_DIR ($CSLD_DATA_DIR) does not exist yet — files sync will be skipped if it stays missing"

log "=== Backup starting (repo=$BACKUP_REPO_DIR, data=$CSLD_DATA_DIR) ==="

# ── 1. Pull latest from remote (best-effort: tolerate offline / first-run) ────

cd "$BACKUP_REPO_DIR"

if git remote get-url "$BACKUP_REMOTE" >/dev/null 2>&1; then
  log "Pulling latest from $BACKUP_REMOTE/$BACKUP_BRANCH"
  if ! git pull --rebase --autostash "$BACKUP_REMOTE" "$BACKUP_BRANCH" >>"$LOG" 2>&1; then
    log "WARNING: git pull failed (offline or no upstream yet). Continuing with local tree."
  fi
else
  log "WARNING: remote '$BACKUP_REMOTE' not configured. Skipping pull."
fi

# ── 2. Sync files via rsync ──────────────────────────────────────────────────

if [ -d "$CSLD_DATA_DIR" ]; then
  log "Syncing files: $CSLD_DATA_DIR/ → $FILES_DIR/"
  rsync -a --delete \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='.DS_Store' \
        --exclude='Thumbs.db' \
        "$CSLD_DATA_DIR/" "$FILES_DIR/" \
    || die "rsync failed"
  FILE_COUNT=$(find "$FILES_DIR" -type f 2>/dev/null | wc -l)
  log "Files synced: $FILE_COUNT"
else
  log "Skipping files sync (source dir missing)"
  FILE_COUNT=0
fi

# ── 3. Dump database ─────────────────────────────────────────────────────────

log "Dumping database → $DB_DIR/latest.sql.gz"
TMP_DUMP="$DB_DIR/latest.sql.gz.tmp"

# Capture stderr separately so we can log it without losing exit-code handling.
DUMP_ERR=$(mktemp)
trap 'rm -f "$DUMP_ERR"' EXIT

"$PG_DUMP_BIN" "$DATABASE_URL" \
    --no-owner \
    --no-privileges \
    --no-sync \
    --quote-all-identifiers \
    $PG_DUMP_EXTRA_ARGS \
  2>"$DUMP_ERR" \
  | gzip -9 \
  > "$TMP_DUMP" \
  || { log "pg_dump stderr:"; cat "$DUMP_ERR" >&2; die "pg_dump failed"; }

[ -s "$TMP_DUMP" ] || die "DB dump is empty"

# Verify the gzip is well-formed before we trust it.
gzip -t "$TMP_DUMP" 2>/dev/null || die "DB dump failed gzip integrity check"

# Atomic move into final location.
mv -f "$TMP_DUMP" "$DB_DIR/latest.sql.gz"
DUMP_SIZE=$(du -h "$DB_DIR/latest.sql.gz" | cut -f1)
log "DB dump written: $DUMP_SIZE"

# Keep a dated copy for forensic value (rolled by HISTORY_KEEP).
HIST_FILE="$HISTORY_DIR/${STAMP}.sql.gz"
cp "$DB_DIR/latest.sql.gz" "$HIST_FILE"
log "Dated copy saved: $HIST_FILE"

# Prune history beyond retention window. Note: -mtime +N means "more than N
# full days old", so a file written yesterday is NOT pruned with -mtime +1
# until 48 hours have elapsed. This is intentional — it gives a small grace
# window in case a cron run is skipped.
if [ "$HISTORY_KEEP" -gt 0 ]; then
  DELETED=$(find "$HISTORY_DIR" -name '*.sql.gz' -mtime +"$HISTORY_KEEP" -print -delete | wc -l)
  log "History pruned: $DELETED files older than $HISTORY_KEEP days"
else
  log "History retention disabled (HISTORY_KEEP=$HISTORY_KEEP), skipping prune"
fi

# ── 4. Commit + push ─────────────────────────────────────────────────────────

log "Staging changes"
git add -A

if git diff --cached --quiet; then
  log "No changes to commit (tree is byte-identical to last successful backup). Done."
  exit 0
fi

# Show what we're about to commit so logs are useful for forensics.
log "Diff summary:"
git diff --cached --stat | head -50 | tee -a "$LOG" >&2

git -c user.name="csld-backup-bot" \
    -c user.email="backup@larpovadatabaze.cz" \
    commit -m "backup $STAMP" \
    >>"$LOG" 2>&1 \
  || die "git commit failed"

log "Pushing to $BACKUP_REMOTE/$BACKUP_BRANCH"
git push "$BACKUP_REMOTE" "$BACKUP_BRANCH" >>"$LOG" 2>&1 \
  || die "git push failed (will retry tomorrow)"

log "=== Backup complete: $STAMP ==="
