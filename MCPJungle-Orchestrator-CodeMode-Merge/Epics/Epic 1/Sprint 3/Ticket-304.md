## Ticket-304 — **Compose**: orch + mock Jungle **with healthchecks** **and** `jungle` **profile**  *(merged)*

**What / Why**
One command brings up **orchestrator + mock Jungle** with startup order; a `profiles: ["jungle"]` block runs with a **real Jungle** too. 

**Where**
`/docker-compose.yml`, `/deploy/compose.env.example`

**Implementation sketch**

* Services: `orch`, `jungle`.
* `jungle.healthcheck` probes `/healthz`.
* `orch.depends_on.jungle.condition: service_healthy`.
* `profiles: ["jungle"]` to swap mock for real Jungle; set `JUNGLE_URL=http://jungle:9000`.

**Tests**
`compose_config.test.sh`: `docker compose config` exit 0 and grep for `profiles: jungle`.

**Accept when**
Compose validates; healthchecks + profile present.

**LLM priming**
`depends_on: condition: service_healthy`, `profiles`, `compose up -d`

---
