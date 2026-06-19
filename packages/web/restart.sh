#!/bin/bash
# CSLD restart script — called via: ssh balda@193.150.13.68 "bash restart.sh"
set -e
cd /home/balda/larpova-databaze/csld-new
export PATH=/usr/local/lib/heroku/bin:/usr/local/lib/heroku/node_modules/.bin:$PATH

# Kill existing server
pkill -f 'tsx server.ts' 2>/dev/null || true
sleep 2

# Start new server in background
nohup npx tsx server.ts > /tmp/csld-new.log 2>&1 &
echo "Server restarted (PID: $!)"
sleep 3
curl -s http://localhost:3000/health
echo ""
