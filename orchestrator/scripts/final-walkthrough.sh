#!/usr/bin/env bash
set -euo pipefail

# Final from-scratch walkthrough automation (Section 14)
# - Brings up compose (orchestrator+jungle)
# - Verifies health
# - Builds and uses Go CLI to register Context7
# - Initializes via orchestrator, captures Mcp-Session-Id
# - Lists tools and calls two Context7 tools
# - Captures container logs and tears down stack

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCH_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ORCH_DIR/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ORCH_DIR/logs/walkthrough-$TS"
mkdir -p "$LOG_DIR"

echo "[final] logs: $LOG_DIR"

cd "$ORCH_DIR"

echo "[final] 1) Stopping prior stack (if any)"
docker compose down -v || true

echo "[final] 1) Starting compose (ORCH_HOST_PORT=18081)"
ORCH_HOST_PORT=18081 docker compose up -d

echo "[final] 2) docker compose ps"
docker compose ps | tee "$LOG_DIR/compose_ps.txt"

echo "[final] 3) Waiting for /healthz and Jungle /health"
ORCH_HEALTH_URL="http://localhost:18081/healthz"
JUNGLE_HEALTH_URL="http://localhost:9000/health"

for i in {1..60}; do
  if curl -fsS "$ORCH_HEALTH_URL" >/dev/null 2>&1; then break; fi
  sleep 1
done
for i in {1..60}; do
  if curl -fsS "$JUNGLE_HEALTH_URL" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -s "$ORCH_HEALTH_URL" | tee "$LOG_DIR/health-orchestrator.json" >/dev/null
curl -s "$JUNGLE_HEALTH_URL" | tee "$LOG_DIR/health-jungle.json" >/dev/null

echo "[final] 5) Build CLI and register Context7 in Jungle"
cd "$REPO_ROOT"
CLI_BIN="$LOG_DIR/mcpjungle"
if command -v go >/dev/null 2>&1; then
  go build -o "$CLI_BIN" .
  "$CLI_BIN" --registry http://localhost:9000 register --name context7 --description "Context7" --url https://mcp.context7.com/mcp \
    | tee "$LOG_DIR/register_context7.txt" || true
  "$CLI_BIN" --registry http://localhost:9000 list servers | tee "$LOG_DIR/list_servers.txt"
else
  echo "[final] WARN: Go not installed; skipping CLI build/registration" | tee "$LOG_DIR/register_context7.txt"
fi

echo "[final] 6) Initialize via orchestrator (capture Mcp-Session-Id)"
cd "$ORCH_DIR"
INIT_OUT="$LOG_DIR/01_initialize.txt"
curl -i -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:18081/mcp | tee "$INIT_OUT" >/dev/null

SESSION=""
if grep -i '^Mcp-Session-Id:' "$INIT_OUT" >/dev/null 2>&1; then
  # shellcheck disable=SC2002
  SESSION=$(cat "$INIT_OUT" | awk 'BEGIN{IGNORECASE=1} /^Mcp-Session-Id:/ {print $2}' | tr -d '\r\n')
fi
echo "SESSION=$SESSION" | tee "$LOG_DIR/vars.env"
echo "[final]   captured session: ${SESSION:-<none>}"

echo "[final] 7) tools/list via orchestrator"
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  http://localhost:18081/mcp | tee "$LOG_DIR/02_tools_list.json" >/dev/null

echo "[final] 8a) tools/call context7__resolve-library-id (lodash)"
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"context7__resolve-library-id","arguments":{"libraryName":"lodash"}}}' \
  http://localhost:18081/mcp | tee "$LOG_DIR/03_resolve.json" >/dev/null

LIB_ID="/lodash/lodash"
if command -v jq >/dev/null 2>&1; then
  LIB_ID=$(jq -r '.result.id // .result.context7CompatibleLibraryID // .result.libraryId // .result.libraryID // "/lodash/lodash"' "$LOG_DIR/03_resolve.json")
else
  echo "[final] jq not found; using default LIB_ID=/lodash/lodash" | tee -a "$LOG_DIR/03_resolve.json" >/dev/null
fi
echo "LIB_ID=$LIB_ID" | tee -a "$LOG_DIR/vars.env"

echo "[final] 8b) tools/call context7__get-library-docs ($LIB_ID)"
curl -s -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"context7__get-library-docs\",\"arguments\":{\"context7CompatibleLibraryID\":\"$LIB_ID\",\"tokens\":2000}}}" \
  http://localhost:18081/mcp | tee "$LOG_DIR/04_docs.json" >/dev/null

echo "[final] 9) Code Mode full pipeline via invoker (generates script, calls Jungle tools)"
(
  export JUNGLE_URL="http://localhost:9000"
  export OTEL_TEST=true
  export CODEMODE_TELEMETRY=true
  export CODEMODE_PERSIST_CODE=true
  export LIVE_USER_ID="walkthrough-user"
  # Default uses stub executor to avoid native build; set CODEMODE_USE_STANDALONE=1 to use real isolates
  npm run -s codemode:live
) | tee "$LOG_DIR/05_codemode_live.log"

echo "[final] capturing container logs"
docker compose logs orchestrator > "$LOG_DIR/orchestrator.log" || true
docker compose logs jungle > "$LOG_DIR/jungle.log" || true
docker compose ps > "$LOG_DIR/compose_ps_before_down.txt" || true

echo "[final] shutting down stack (docker compose down -v)"
docker compose down -v | tee "$LOG_DIR/compose_down.txt" || true

echo "[final] DONE. Logs and outputs in: $LOG_DIR"
echo "[final] Summary:"
echo "  vars     : $LOG_DIR/vars.env"
echo "  init hdr : $LOG_DIR/01_initialize.txt"
echo "  tools    : $LOG_DIR/02_tools_list.json"
echo "  resolve  : $LOG_DIR/03_resolve.json (LIB_ID=$LIB_ID)"
echo "  docs     : $LOG_DIR/04_docs.json"
echo "  orch log : $LOG_DIR/orchestrator.log"
echo "  jungle   : $LOG_DIR/jungle.log"


