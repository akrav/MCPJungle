#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

docker rm -f orch_run_test >/dev/null 2>&1 || true
docker build -t orch:test . >/dev/null
docker run -d --name orch_run_test -p 18080:8080 orch:test >/dev/null

trap 'docker rm -f orch_run_test >/dev/null 2>&1 || true' EXIT

for i in {1..20}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:18080/healthz || true)
  if [[ "$status" == "200" ]]; then
    echo "healthz OK"
    exit 0
  fi
  sleep 1
done

echo "healthz failed" >&2
exit 1


