#!/usr/bin/env bash
set -euo pipefail

IFACE=${IFACE:-eth0}
LOSS=${LOSS:-5%}

sudo tc qdisc add dev "$IFACE" root netem loss "$LOSS" || true
trap 'sudo tc qdisc del dev "$IFACE" root netem || true' EXIT

echo "Packet loss injected on $IFACE: $LOSS"
sleep 10
