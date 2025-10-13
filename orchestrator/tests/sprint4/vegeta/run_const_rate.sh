#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

RATE=${RATE:-50}
DURATION=${DURATION:-30s}

vegeta attack -rate=${RATE} -duration=${DURATION} -targets=./targets.list | vegeta report
