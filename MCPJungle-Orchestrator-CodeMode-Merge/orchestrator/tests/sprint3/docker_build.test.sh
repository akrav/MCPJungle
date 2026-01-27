#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "Building orchestrator image..."
docker build -t orch:test . >/dev/null
echo "OK"


