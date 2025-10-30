# Ticket-3608 — K8s provisioner stub (client & unit tests)

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3608 — K8s provisioner stub (client & unit tests)")

What / Why
- Add a minimal k8s.ts provisioner that composes Deployment/Service manifests and returns a predictable baseUrl shape; unit tests only.

Where
- /orchestrator/src/provisioning/k8s.ts

Implementation sketch
- Pure functions to build manifests (apiVersion, kind, metadata.labels.userId) and compute baseUrl from service name + port.

Tests
- tests/sprint6-provisioning/provisioner_interface.spec.ts: manifest fields & URL composition; conforms to Provisioner interface (methods may throw NotImplemented at runtime).

Accept when
- Type-safe stub exists; unit tests pass.

Process
- Implement → write tests → run → fix → push.
