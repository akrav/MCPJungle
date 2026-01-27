# Sprint 3 — Packaging & Dev/Stage Deploy (Updated)

**Goal**
Make local + CI flows boringly reliable: slim Docker image, one-command Compose stack, and a staging image published to GHCR. Keep `/mcp` behavior unchanged (pure pass-through). 

**What changed (merges)**

* **302 + 309 → 302** “Dockerfile (multi-stage, non-root, HEALTHCHECK)”.
* **304 + 310 → 304** “Compose (orch + mock Jungle + `jungle` profile)”.

**Rule of engagement**
Do tickets **in order**. For each ticket: code → tests → run → fix until green → commit & push.

**Repo (new/updated files)**

```
/orchestrator
  Dockerfile
  .dockerignore
  docker-compose.yml
  /deploy
    compose.env.example
    k8s/ (placeholder)
  .github/workflows/ci.yml
  /tests/sprint3
    docker_build.test.sh
    docker_run_health.test.sh
    compose_config.test.sh
    compose_up_health.test.sh
    ghcr_login_guard.test.sh
    ghcr_tags_convention.spec.ts
    readme_compose_quickstart.spec.ts
```

---

## Ticket-301 — Add **.dockerignore**

**What / Why**
Shrink build context for faster, safer images. Ignore `node_modules`, `dist`, `.git`, `coverage`, logs. (Docker multi-stage docs for context.) 

**Where**
`/.dockerignore`

**Tests**
`docker_build.test.sh` prints context size (sanity) and ensures build succeeds.

**Accept when**
Build works; noisy dirs excluded.

**LLM priming**
`.dockerignore`, `Docker build context size`, `exclude node_modules`

---

## Ticket-302 — **Dockerfile**: multi-stage (Node 20-alpine), **non-root**, + **HEALTHCHECK**  *(merged)*

**What / Why**
Smaller, safer image: builder → runner; drop dev deps; run as `node`; add `HEALTHCHECK` for `/healthz`. 

**Where**
`/Dockerfile`

**Implementation sketch**

* **Builder**: `FROM node:20-alpine`, `npm ci`, `npm run build`.
* **Runner**: `NODE_ENV=production`, `npm ci --omit=dev`, `USER node`, `CMD ["node","dist/server/http.js"]`,
  `HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:8080/healthz || exit 1`.

**Tests**
`docker_build.test.sh` (build exit 0) and `docker_run_health.test.sh` (container becomes **healthy** and `/healthz` 200).

**Accept when**
Build succeeds, container runs as non-root, health turns **healthy**.

**LLM priming**
`multi-stage`, `node:20-alpine`, `USER node`, `HEALTHCHECK CMD`

---

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

## Ticket-305 — Compose up **smoke**: health then `/mcp initialize`

**What / Why**
Integration check: stack is healthy, `/mcp` handles a minimal JSON-RPC `initialize`.

**Where**
`tests/sprint3/compose_up_health.test.sh`

**Tests / Accept**
Poll `/healthz` → POST `{"jsonrpc":"2.0","id":1,"method":"initialize"}` → has `result`.

**LLM priming**
`curl -H 'Content-Type: application/json' -d`, `jq -e '.result'`

---

## Ticket-306 — **GHCR login guard** (CI secret present & usable)

**What / Why**
Fail fast if GHCR token is missing so the pipeline doesn’t waste minutes. 

**Where**
`.github/workflows/ci.yml`, `tests/sprint3/ghcr_login_guard.test.sh`

**Tests / Accept**
`docker login ghcr.io` succeeds (or fails meaningfully).

**LLM priming**
`CR_PAT`, `GITHUB_ACTOR`, `--password-stdin`

---

## Ticket-307 — GitHub Actions: **build & test Node** (with cache)

**What / Why**
Adds speedy Node CI with `actions/setup-node` caching.

**Where**
`.github/workflows/ci.yml` (job `test`)

**Accept when**
`npm ci && npm test` runs; subsequent runs use cache.

**LLM priming**
`actions/setup-node@v4`, `cache: npm`, `matrix: node-version`

---

## Ticket-308 — GitHub Actions: **build & push** Docker image (Buildx → **GHCR**)

**What / Why**
Publish images tagged `:sha-<short>` and `:staging` using `docker/build-push-action` and GHA cache. 

**Where**
`.github/workflows/ci.yml` (job `image`)

**Tests**
`ghcr_tags_convention.spec.ts` validates action versions + tag patterns.

**Accept when**
Push happens on main; tags match convention.

**LLM priming**
`setup-buildx-action`, `build-push-action@v6`, `cache-from/to type=gha`, `ghcr.io/<org>/<repo>:staging`

---

## Ticket-309 — README: **Compose Quickstart** (copy-pasteable)

**What / Why**
A short “do this” doc for devs: env file, compose up, `curl` health & initialize.

**Where**
`/README.md`

**Tests / Accept**
`readme_compose_quickstart.spec.ts` greps headings and code blocks.

**LLM priming**

```
cp deploy/compose.env.example .env
docker compose up -d
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:8080/mcp
```

---

## Ticket-310 — (Optional) **K8s skeleton** manifests

**What / Why**
Placeholders for later sprints with **readiness/liveness/startup** probes to `/healthz`. (Keep dry; don’t apply yet.) 

**Where**
`/deploy/k8s/deployment.yaml`, `/deploy/k8s/service.yaml`

**Accept when**
YAML is valid and documented as **placeholder**.

**LLM priming**
`readinessProbe httpGet /healthz`, `livenessProbe`, `startupProbe`

---

## How to run Sprint 3 tests locally

```bash
# Build the image
bash tests/sprint3/docker_build.test.sh

# Run container and verify /healthz
bash tests/sprint3/docker_run_health.test.sh

# Validate compose & bring up the stack
bash tests/sprint3/compose_config.test.sh
bash tests/sprint3/compose_up_health.test.sh
```

---

### Why these priming cues work

They match well-trodden patterns from Docker, Compose startup order, and GitHub Actions Buildx/GHCR docs—so an LLM produces **idiomatic, low-ambiguity** edits that pass your scripts on the first try. 

If you want, I can also generate tiny **stub scripts/YAML** with TODOs so several tickets go green with near-zero extra calls.
