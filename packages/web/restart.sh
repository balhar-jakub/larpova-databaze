#!/bin/bash
# CSLD PRODUCTION restart script — port 8080
set -e
cd /home/balda/larpova-databaze/csld-new
export PATH=/usr/local/lib/heroku/bin:/usr/local/lib/heroku/node_modules/.bin:$PATH

# Kill ONLY production instance (won't touch test on 8082)
pkill -f "csld-new.*server\.ts" 2>/dev/null || true
sleep 2

nohup npx tsx server.ts > /tmp/csld-new.log 2>&1 &
echo "Production restarted (PID: $!)"
sleep 4
curl -s http://localhost:8080/health
echo ""
