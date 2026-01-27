#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."

# Pre-req: docker compose up -d

# Fire a long tools/call in background
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call"}' \
  http://localhost:8080/mcp >/dev/null &
CALL_PID=$!

sleep 1
# Restart jungle container
(docker compose restart jungle || docker restart jungle) >/dev/null 2>&1 || true
wait $CALL_PID || true

echo "Chaos test executed. Manually check orchestrator health at /healthz."
