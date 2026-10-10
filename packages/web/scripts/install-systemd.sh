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
ExecStart=/bin/bash -lc 'exec npx tsx server.ts'
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
