#!/bin/bash
# CSLD systemd service installer — phase 6.
# Installs a user-level systemd unit (no root needed) for one environment
# (test or production) and enables Restart=always supervision.
#
# Usage (from the deploy workflow, over SSH):
#   bash scripts/install-systemd.sh <test|production>
#
# Requirements on the box: systemd with user lingering enabled
# (loginctl enable-linger) — see the deploy workflow, which enables it.
set -euo pipefail

ENV_NAME="${1:?usage: install-systemd.sh <test|production>}"

case "$ENV_NAME" in
  test)       APP_DIR=/home/balda/larpova-databaze/csld-test; PORT=8082 ;;
  production)  APP_DIR=/home/balda/larpova-databaze/csld-new; PORT=8080 ;;
  *) echo "unknown environment: $ENV_NAME" >&2; exit 2 ;;
esac

UNIT_NAME="csld-$ENV_NAME.service"
UNIT_PATH="$HOME/.config/systemd/user/$UNIT_NAME"
mkdir -p "$(dirname "$UNIT_PATH")"

# Resolve npx/tsx to ABSOLUTE paths: the systemd user session does not
# inherit the login-shell PATH (the heroku node toolchain lives outside
# the default PATH), so a unit calling bare `npx` dies with status 127
# in a restart loop — exactly what the first phase-6 test deploy caught.
NPX="$(command -v npx || true)"
TSX_BIN="$(command -v tsx || true)"
if [ -z "$NPX" ]; then
  # last resort: the toolchain path the deploy workflow exports
  for cand in /usr/local/lib/heroku/bin/npx /usr/local/bin/npx /usr/bin/npx; do
    if [ -x "$cand" ]; then NPX="$cand"; break; fi
  done
fi
if [ -z "$NPX" ]; then
  echo "FATAL: npx not found in PATH — cannot build a working unit" >&2
  exit 3
fi
# Prefer the direct tsx binary when available (fewer moving parts than npx),
# otherwise run it through npx.
if [ -n "$TSX_BIN" ]; then
  EXEC_START="$TSX_BIN server.ts"
else
  EXEC_START="$NPX tsx server.ts"
fi
# The node binaries use /usr/bin/env shebangs: without PATH in the unit
# environment, `npx` starts but cannot find `node` itself (the second
# failure mode the phase-6 deploys caught). Bake the installing shell's
# PATH — which includes the toolchain dir — into the unit.
UNIT_PATH_ENV="$PATH"

cat > "$UNIT_PATH" <<EOF
[Unit]
Description=CSLD $ENV_NAME (larpovadatabaze.cz)
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=PATH=$UNIT_PATH_ENV
ExecStart=$EXEC_START
Restart=always
RestartSec=5
# The session secret gate (phase 1) throws when SESSION_SECRET is missing —
# a restart loop would be loud, which is exactly what we want.
StartLimitIntervalSec=0

[Install]
WantedBy=default.target
EOF

# Linger so the unit runs at boot without anyone logged in.
loginctl enable-linger "$USER" 2>/dev/null || echo "WARNING: could not enable linger" >&2

systemctl --user daemon-reload
systemctl --user enable "$UNIT_NAME"

echo "installed $UNIT_NAME -> $UNIT_PATH"
