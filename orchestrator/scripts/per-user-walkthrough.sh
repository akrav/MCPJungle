#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCH_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ORCH_DIR/logs/peruser-$TS"
mkdir -p "$LOG_DIR"
echo "[peruser] logs: $LOG_DIR"

cd "$ORCH_DIR"

echo "[peruser] starting orchestrator compose"
docker compose down -v || true
ORCH_HOST_PORT=18081 docker compose up -d
docker compose ps | tee "$LOG_DIR/compose_ps.txt" >/dev/null

echo "[peruser] wait health"
for i in {1..60}; do curl -fsS http://localhost:18081/healthz >/dev/null 2>&1 && break || sleep 1; done

echo "[peruser] shared: initialize via curl"
curl -i -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' http://localhost:18081/mcp | tee "$LOG_DIR/01_shared_initialize.txt" >/dev/null || true
echo "[peruser] shared: tools/list via curl"
curl -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' http://localhost:18081/mcp | tee "$LOG_DIR/02_shared_tools_list.json" >/dev/null || true

echo "[peruser] per-user (alice): auto-provision via router"
export JUNGLE_URL="http://localhost:9000"
export ROUTING_MODE="per_user"
export PROVISION_ON_DEMAND="true"
export PROVISIONER="docker"
export CODEMODE_VERBOSE_LOGS="true"
export CODEMODE_LOG_DIR="$LOG_DIR"
export CODEMODE_AUTO_INIT=1

echo "[peruser] alice initialize (triggers provision)"
curl -i -s -H 'Content-Type: application/json' -H 'x-user-id: alice' -d '{"jsonrpc":"2.0","id":10,"method":"initialize"}' http://localhost:18081/mcp | tee "$LOG_DIR/10_alice_initialize.txt" >/dev/null || true
echo "[peruser] alice tools/list"
curl -s -H 'Content-Type: application/json' -H 'x-user-id: alice' -d '{"jsonrpc":"2.0","id":11,"method":"tools/list","params":{}}' http://localhost:18081/mcp | tee "$LOG_DIR/11_alice_tools_list.json" >/dev/null || true

echo "[peruser] alice Code Mode run"
LIVE_USER_ID="alice" npm run -s codemode:live | tee "$LOG_DIR/11_alice_codemode.txt" || true

echo "[peruser] bob initialize (triggers provision)"
curl -i -s -H 'Content-Type: application/json' -H 'x-user-id: bob' -d '{"jsonrpc":"2.0","id":20,"method":"initialize"}' http://localhost:18081/mcp | tee "$LOG_DIR/20_bob_initialize.txt" >/dev/null || true
echo "[peruser] bob tools/list"
curl -s -H 'Content-Type: application/json' -H 'x-user-id: bob' -d '{"jsonrpc":"2.0","id":21,"method":"tools/list","params":{}}' http://localhost:18081/mcp | tee "$LOG_DIR/21_bob_tools_list.json" >/dev/null || true

echo "[peruser] bob Code Mode run"
LIVE_USER_ID="bob" npm run -s codemode:live | tee "$LOG_DIR/21_bob_codemode.txt" || true

echo "[peruser] capturing orchestration logs"
docker compose logs orchestrator > "$LOG_DIR/orchestrator.log" || true
docker ps --format '{{.Names}}\t{{.Ports}}' | tee "$LOG_DIR/docker_ps.txt" >/dev/null
for n in jungle-alice jungle-bob; do docker logs "$n" > "$LOG_DIR/${n}.log" 2>&1 || true; done

echo "[peruser] stopping stack"
docker compose down -v | tee "$LOG_DIR/compose_down.txt" || true

echo "[peruser] DONE -> $LOG_DIR"


