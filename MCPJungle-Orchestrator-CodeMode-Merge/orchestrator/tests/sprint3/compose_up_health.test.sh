#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

docker compose down -v >/dev/null 2>&1 || true
docker compose up -d --build >/dev/null
trap 'docker compose down -v >/dev/null 2>&1 || true' EXIT

for i in {1..30}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/healthz || true)
  if [[ "$code" == "200" ]]; then
    break
  fi
  sleep 1
done

resp=$(curl -s -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' http://localhost:8080/mcp)
echo "$resp" | grep -q '"result"' && echo "initialize OK" || (echo "initialize failed: $resp" >&2; exit 1)
