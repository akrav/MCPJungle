#!/usr/bin/env bash
set -euo pipefail

IFACE=${IFACE:-eth0}
DELAY=${DELAY:-200ms}

sudo tc qdisc add dev "$IFACE" root netem delay "$DELAY" || true
trap 'sudo tc qdisc del dev "$IFACE" root netem || true' EXIT

echo "Latency injected on $IFACE: $DELAY"
sleep 10
