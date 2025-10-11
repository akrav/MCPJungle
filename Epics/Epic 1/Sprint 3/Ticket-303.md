## Ticket-303 — Docker local run **smoke (health)**

**What / Why**
Prove the container boots and `/healthz` returns `{"ok":true}`.

**Where**
`tests/sprint3/docker_run_health.test.sh`

**Tests / Accept**
Run → curl → assert → cleanup.

**LLM priming**
`docker run -d -p`, `curl /healthz`, `trap cleanup`

---
