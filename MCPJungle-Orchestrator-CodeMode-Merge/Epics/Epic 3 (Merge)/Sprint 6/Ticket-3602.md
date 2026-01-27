# Ticket-3602 — Docker provisioner (local dev)

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3602 — Docker provisioner (local dev)")

What / Why
- Implement docker.ts to start/stop a Jungle container for a user in dev environments.

Where
- /orchestrator/src/provisioning/docker.ts

Implementation sketch
- docker run -d --name jungle-<userId> -p 0:9000 -e ... <JUNGLE_IMAGE>
- Parse docker inspect JSON to get host port → baseUrl http://127.0.0.1:<hostPort>.
- docker stop/rm for teardown.

Tests
- tests/sprint6-provisioning/docker_command_build.spec.ts: command composition & inspect parsing (no live docker).

Accept when
- Deterministic command strings/parsing; tests pass without docker.

Process
- Implement → write tests → run → fix → push.
