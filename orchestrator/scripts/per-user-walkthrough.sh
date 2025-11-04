#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCH_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ORCH_DIR/logs/peruser-$TS"
mkdir -p "$LOG_DIR"
echo "[peruser] logs: $LOG_DIR"

cd "$ORCH_DIR"

register_cli() {
  if [ -x "${ORCH_DIR}/../mcpjungle" ]; then
    echo "[peruser] CLI present"
    return 0
  fi
  if command -v go >/dev/null 2>&1; then
    echo "[peruser] building CLI"
    (cd "$ORCH_DIR/.." && go build -o mcpjungle .) || true
  fi
}

host_port_for() {
  local name="$1"
  docker inspect -f '{{(index (index .NetworkSettings.Ports "9000/tcp") 0).HostPort}}' "$name" 2>/dev/null || true
}

register_context7_for() {
  local user="$1"
  local cname="jungle-${user}"
  local port
  port=$(host_port_for "$cname")
  if [ -z "$port" ]; then
    echo "[peruser] no port for $cname yet"
    return 0
  fi
  local reg="http://127.0.0.1:${port}"
  echo "[peruser] registering context7 for $user at $reg"
  if [ -x "${ORCH_DIR}/../mcpjungle" ]; then
    "${ORCH_DIR}/../mcpjungle" --registry "$reg" register \
      --name context7 --description "Context7" --url https://mcp.context7.com/mcp \
      >"$LOG_DIR/${user}_register.txt" 2>&1 || true
    "${ORCH_DIR}/../mcpjungle" --registry "$reg" list servers \
      >"$LOG_DIR/${user}_servers.txt" 2>&1 || true
  else
    echo "[peruser] mcpjungle CLI not available; skip register" | tee -a "$LOG_DIR/${user}_register.txt" >/dev/null
  fi
}

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

register_cli
register_context7_for alice

echo "[peruser] alice tools/list after register"
curl -s -H 'Content-Type: application/json' -H 'x-user-id: alice' -d '{"jsonrpc":"2.0","id":12,"method":"tools/list","params":{}}' http://localhost:18081/mcp | tee "$LOG_DIR/12_alice_tools_list_after.json" >/dev/null || true

echo "[peruser] alice context7 resolve"
curl -s -H 'Content-Type: application/json' -H 'x-user-id: alice' -d '{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"context7__resolve-library-id","arguments":{"libraryName":"lodash"}}}' http://localhost:18081/mcp | tee "$LOG_DIR/13_alice_context7_resolve.json" >/dev/null || true

echo "[peruser] alice Code Mode run"
LIVE_USER_ID="alice" npm run -s codemode:live | tee "$LOG_DIR/14_alice_codemode.txt" || true

echo "[peruser] bob initialize (triggers provision)"
curl -i -s -H 'Content-Type: application/json' -H 'x-user-id: bob' -d '{"jsonrpc":"2.0","id":20,"method":"initialize"}' http://localhost:18081/mcp | tee "$LOG_DIR/20_bob_initialize.txt" >/dev/null || true
echo "[peruser] bob tools/list"
curl -s -H 'Content-Type: application/json' -H 'x-user-id: bob' -d '{"jsonrpc":"2.0","id":21,"method":"tools/list","params":{}}' http://localhost:18081/mcp | tee "$LOG_DIR/21_bob_tools_list.json" >/dev/null || true

register_context7_for bob

echo "[peruser] bob tools/list after register"
curl -s -H 'Content-Type: application/json' -H 'x-user-id: bob' -d '{"jsonrpc":"2.0","id":22,"method":"tools/list","params":{}}' http://localhost:18081/mcp | tee "$LOG_DIR/22_bob_tools_list_after.json" >/dev/null || true

echo "[peruser] bob context7 resolve"
curl -s -H 'Content-Type: application/json' -H 'x-user-id: bob' -d '{"jsonrpc":"2.0","id":23,"method":"tools/call","params":{"name":"context7__resolve-library-id","arguments":{"libraryName":"lodash"}}}' http://localhost:18081/mcp | tee "$LOG_DIR/23_bob_context7_resolve.json" >/dev/null || true

echo "[peruser] bob Code Mode run"
LIVE_USER_ID="bob" npm run -s codemode:live | tee "$LOG_DIR/24_bob_codemode.txt" || true

echo "[peruser] capturing orchestration logs"
docker compose logs orchestrator > "$LOG_DIR/orchestrator.log" || true
docker ps --format '{{.Names}}\t{{.Ports}}' | tee "$LOG_DIR/docker_ps.txt" >/dev/null
for n in jungle-alice jungle-bob; do docker logs "$n" > "$LOG_DIR/${n}.log" 2>&1 || true; done

echo "[peruser] stopping stack"
docker compose down -v | tee "$LOG_DIR/compose_down.txt" || true

echo "[peruser] DONE -> $LOG_DIR"


