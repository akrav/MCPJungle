#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

docker compose config >/dev/null
docker compose config | grep -q "profiles:" && echo "profiles present" || (echo "missing profiles" >&2; exit 1)


