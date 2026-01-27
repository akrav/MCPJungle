#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CR_PAT:-}" || -z "${GITHUB_ACTOR:-}" ]]; then
  echo "Skipping GHCR login test; CR_PAT or GITHUB_ACTOR not set" >&2
  exit 0
fi

echo "$CR_PAT" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
echo "GHCR login OK"
