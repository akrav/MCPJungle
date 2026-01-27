#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCH_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ORCH_DIR/logs/peruser-$TS"
mkdir -p "$LOG_DIR"
echo "[peruser] logs: $LOG_DIR"

# Per-user folders
AL_DIR="$LOG_DIR/users/alice"
BO_DIR="$LOG_DIR/users/bob"
mkdir -p "$AL_DIR" "$BO_DIR"

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
  local udir="$LOG_DIR/users/${user}"
  echo "[peruser] registering context7 for $user at $reg"
  if [ -x "${ORCH_DIR}/../mcpjungle" ]; then
    "${ORCH_DIR}/../mcpjungle" --registry "$reg" register \
      --name context7 --description "Context7" --url https://mcp.context7.com/mcp \
      >"$udir/register.txt" 2>&1 || true
    "${ORCH_DIR}/../mcpjungle" --registry "$reg" list servers \
      >"$udir/servers.txt" 2>&1 || true
  else
    echo "[peruser] mcpjungle CLI not available; skip register" | tee -a "$udir/register.txt" >/dev/null
  fi
}

retry_call() {
  # args: user session id name json_payload out_file
  local user="$1"; shift
  local sess="$1"; shift
  local id="$1"; shift
  local name="$1"; shift
  local payload="$1"; shift
  local out="$1"; shift
  local tries=0
  while [ $tries -lt 3 ]; do
    curl -s -H 'Content-Type: application/json' \
      -H 'Accept: application/json, text/event-stream' \
      -H "Mcp-Session-Id: $sess" -H "x-user-id: $user" \
      -d "{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$payload}}" \
      http://localhost:18081/mcp | tee "$out" >/dev/null || true
    if ! grep -q '"error"' "$out"; then break; fi
    sleep 2; tries=$((tries+1))
  done
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
curl -i -s -H 'Content-Type: application/json' -H 'x-user-id: alice' -d '{"jsonrpc":"2.0","id":10,"method":"initialize"}' http://localhost:18081/mcp | tee "$AL_DIR/initialize.txt" >/dev/null || true
ALICE_SESSION=$(grep -i '^Mcp-Session-Id:' "$AL_DIR/initialize.txt" | awk '{print $2}' | tr -d '\r')
## tools/list not meaningful for remote MCPs; skipping file output

register_cli
register_context7_for alice

## tools/list after register skipped

echo "[peruser] alice context7 resolve"
sleep 1
retry_call alice "$ALICE_SESSION" 13 context7__resolve-library-id '{"libraryName":"lodash"}' "$AL_DIR/context7_resolve.json"
if grep -q '"error"' "$AL_DIR/context7_resolve.json" 2>/dev/null; then rm -f "$AL_DIR/context7_resolve.json"; fi

echo "[peruser] alice Code Mode run"
CODEMODE_LOG_DIR="$AL_DIR" LIVE_USER_ID="alice" npm run -s codemode:live | tee "$AL_DIR/codemode_trace.txt" || true

echo "[peruser] bob initialize (triggers provision)"
curl -i -s -H 'Content-Type: application/json' -H 'x-user-id: bob' -d '{"jsonrpc":"2.0","id":20,"method":"initialize"}' http://localhost:18081/mcp | tee "$BO_DIR/initialize.txt" >/dev/null || true
BOB_SESSION=$(grep -i '^Mcp-Session-Id:' "$BO_DIR/initialize.txt" | awk '{print $2}' | tr -d '\r')
## tools/list not meaningful for remote MCPs; skipping file output

register_context7_for bob

## tools/list after register skipped

echo "[peruser] bob context7 resolve"
sleep 1
retry_call bob "$BOB_SESSION" 23 context7__resolve-library-id '{"libraryName":"lodash"}' "$BO_DIR/context7_resolve.json"
if grep -q '"error"' "$BO_DIR/context7_resolve.json" 2>/dev/null; then rm -f "$BO_DIR/context7_resolve.json"; fi

echo "[peruser] bob Code Mode run"
CODEMODE_LOG_DIR="$BO_DIR" LIVE_USER_ID="bob" npm run -s codemode:live | tee "$BO_DIR/codemode_trace.txt" || true

echo "[peruser] capturing orchestration logs"
docker compose logs orchestrator > "$LOG_DIR/orchestrator.log" || true
docker ps --format '{{.Names}}\t{{.Ports}}' | tee "$LOG_DIR/docker_ps.txt" >/dev/null
docker logs jungle-alice > "$AL_DIR/jungle.log" 2>&1 || true
docker logs jungle-bob > "$BO_DIR/jungle.log" 2>&1 || true

echo "[peruser] stopping stack"
docker compose down -v | tee "$LOG_DIR/compose_down.txt" || true

echo "[peruser] DONE -> $LOG_DIR"


