Reference anchors used for accuracy:

* **Docker multi-stage builds** & Node images. ([Docker Documentation][1])
* **Compose** services, healthchecks, and **depends_on: condition: service_healthy** for startup order. ([Docker Documentation][2])
* **GitHub Actions** for Node builds, dependency cache, and pushing images to **GitHub Container Registry (GHCR)** with **docker/build-push-action**. ([GitHub Docs][3])
* (If you deploy to K8s later) **liveness/readiness/startup probes** patterns. ([Kubernetes][4])

---

# Sprint 3 — Packaging & Dev/Stage Deploy

**Goal**
Make it trivially easy to run locally with Docker Compose and create a **staging image** built in CI and pushed to GHCR. Include healthchecks, sane defaults, and docs. No behavior changes to `/mcp`: this sprint is packaging and deploy hygiene.

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, **loop & debug** until green, then push.

**Repo (new/updated files called out below)**

```
/orchestrator
  Dockerfile
  .dockerignore
  docker-compose.yml
  /deploy
    compose.env.example
    k8s/ (placeholder manifests for later sprints)
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

## Ticket-301 — Add .dockerignore

**What / Why**
Create a **.dockerignore** to keep images small and builds fast (ignore `node_modules`, `dist` if rebuilt, `.git`, tests). Smaller images = less attack surface. ([Docker Documentation][1])

**Where**
`/.dockerignore`

**Implementation sketch**
Ignore: `.git`, `.github`, `node_modules`, `dist`, `coverage`, `*.log`.

**Tests**
`/tests/sprint3/docker_build.test.sh` (later Ticket-303) will measure build succeeds and uses small context (sanity: print `docker build` context size).

**Accept when**
Build works and context excludes noisy dirs.

**Plain English**

> Don’t send junk into the Docker build; it makes images bigger and slower.

**LLM priming**
`.dockerignore patterns`, `node_modules`, `.git`, `dist`, `Docker build context`

---

## Ticket-302 — Multi-stage Dockerfile (Node 20-alpine, non-root)

**What / Why**
Create a **multi-stage** Dockerfile: builder → runtime. Use `node:20-alpine`, copy only `dist/` and production deps, run as **non-root**. Multi-stage reduces size and surface. ([Docker Documentation][1])

**Where**
`/Dockerfile`

**Implementation sketch**

* Stage `builder`: `npm ci`, `npm run build`.
* Stage `runner`: `NODE_ENV=production`, `npm ci --omit=dev`, `USER node`, `HEALTHCHECK` to `/healthz`.
* `CMD ["node","dist/server/http.js"]`.

**Tests**
`/tests/sprint3/docker_build.test.sh`: `docker build -t orch:local .` → exit 0.

**Accept when**
Build succeeds; final image runs `node` as non-root.

**Plain English**

> Build in one layer, run in another—lighter and safer.

**LLM priming**
`multi-stage`, `node:20-alpine`, `npm ci --omit=dev`, `USER node`, `HEALTHCHECK` ([Docker Documentation][1])

---

## Ticket-303 — Docker local run smoke (health)

**What / Why**
Verify the container boots and `GET /healthz` returns 200.

**Where**
`/tests/sprint3/docker_run_health.test.sh`

**Implementation sketch**

* `docker run -d -p 8080:8080 --name orch orch:local`
* `curl http://localhost:8080/healthz | jq .ok` equals `true`.

**Accept when**
Script exits 0, then cleans up the container.

**Plain English**

> Confirm the container actually starts and answers “I’m alive.”

**LLM priming**
`docker run -d -p`, `curl /healthz`, `jq`, `trap cleanup`

---

## Ticket-304 — Compose: orchestrator + mock Jungle with healthchecks

**What / Why**
One-command dev stack: orchestrator + **mock Jungle**. Use **healthcheck** and **depends_on: condition: service_healthy** so orchestrator waits for Jungle. ([Docker Documentation][5])

**Where**
`/docker-compose.yml`, `/deploy/compose.env.example`

**Implementation sketch**

* Services: `orch`, `jungle`.
* `jungle.healthcheck`: hits `/healthz` or simple TCP check;
* `orch.depends_on.jungle.condition: service_healthy`; pass `JUNGLE_URL=http://jungle:9000`.

**Tests**
`/tests/sprint3/compose_config.test.sh`: `docker compose config` must exit 0.

**Accept when**
Compose validates; services defined with healthchecks.

**Plain English**

> Start both services with one command and wait until Jungle is ready.

**LLM priming**
`depends_on: condition: service_healthy`, `healthcheck`, `docker compose up -d` ([Docker Documentation][5])

---

## Ticket-305 — Compose up smoke: health then /mcp initialize

**What / Why**
Run the whole stack and make sure `/mcp` responds to `initialize`.

**Where**
`/tests/sprint3/compose_up_health.test.sh`

**Implementation sketch**

* `docker compose up -d`; poll `orch` `/healthz` until OK;
* POST JSON-RPC `{jsonrpc:"2.0",id:1,method:"initialize"}` to `/mcp`; expect 200 with `result`.

**Accept when**
Both checks pass; compose down in teardown.

**Plain English**

> Prove the two containers work together.

**LLM priming**
`curl -H 'Content-Type: application/json' -d`, `jq -e '.result'`, `poll with retry`

---

## Ticket-306 — GHCR login guard (CI secret present and usable)

**What / Why**
Add a **CI guard test** that verifies GitHub Actions can log into **GHCR** before attempting pushes (fail fast if secret missing). ([GitHub Docs][6])

**Where**
`.github/workflows/ci.yml`, `/tests/sprint3/ghcr_login_guard.test.sh`

**Implementation sketch**

* In CI, `echo $CR_PAT | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin`.
* Gate step runs before build-push job; if login fails → stop early.

**Accept when**
Guard passes in CI; fails meaningfully if token is missing.

**Plain English**

> Make CI tell us early if it can’t push images.

**LLM priming**
`docker login ghcr.io`, `GITHUB_ACTOR`, `CR_PAT`, `--password-stdin` ([GitHub Docs][6])

---

## Ticket-307 — GitHub Actions: build & test Node (with cache)

**What / Why**
Standard **Node build+test** job with dependency caching (`actions/setup-node` cache). Faster CI, reliable signal. ([GitHub Docs][3])

**Where**
`.github/workflows/ci.yml` (job `test`)

**Implementation sketch**

* Steps: `actions/checkout`, `actions/setup-node@v4` with `cache: npm`, `npm ci`, `npm run test`.

**Accept when**
Job turns green and is noticeably faster on second run.

**Plain English**

> Run our tests in CI quickly using npm cache.

**LLM priming**
`actions/setup-node@v4`, `cache: 'npm'`, `npm ci`, `matrix: node-version` ([GitHub][7])

---

## Ticket-308 — GitHub Actions: build & push Docker image (Buildx)

**What / Why**
CI job builds and pushes the container to **GHCR** using **docker/build-push-action** with BuildKit cache, tagging `:sha-<short>` and `:staging`. ([GitHub][8])

**Where**
`.github/workflows/ci.yml` (job `image`)

**Implementation sketch**

* `docker/setup-buildx-action@v3`
* `docker/login-action@v3` to GHCR
* `docker/build-push-action@v6` with `cache-from: type=gha` / `cache-to: type=gha,mode=max`
* `tags: ghcr.io/<org>/<repo>:sha-${{ github.sha.substr(0,7) }}, ghcr.io/<org>/<repo>:staging`

**Tests**
`/tests/sprint3/ghcr_tags_convention.spec.ts`: static check of workflow YAML to ensure tags and actions versions present.

**Accept when**
Job pushes an image on main; tags follow convention.

**Plain English**

> Automatically build the image in CI and push it to the registry.

**LLM priming**
`buildx`, `cache-from/to type=gha`, `docker/login-action`, `build-push-action`, `ghcr tags` ([GitHub][8])

---

## Ticket-309 — HEALTHCHECK in Dockerfile (curl /healthz)

**What / Why**
Add a **Docker HEALTHCHECK** that hits `/healthz` so Compose/K8s can use it for startup order/readiness. ([Docker Documentation][5])

**Where**
`/Dockerfile` (runtime stage)

**Implementation sketch**
`HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:8080/healthz || exit 1`

**Tests**
Covered by Ticket-303 and Ticket-305, which rely on healthy state.

**Accept when**
`docker inspect` shows healthy after boot.

**Plain English**

> Teach Docker how to tell if the app is okay.

**LLM priming**
`HEALTHCHECK CMD`, `curl/wget 200`, `exit 1 on failure`

---

## Ticket-310 — Compose profile: “jungle” (real MCPJungle)

**What / Why**
Add a **Compose profile** named `jungle` to run the orchestrator with a **real** MCPJungle container (not mock), wiring `JUNGLE_URL=http://jungle:9000`. ([Docker Documentation][2])

**Where**
`/docker-compose.yml`

**Implementation sketch**

* `profiles: ["jungle"]` on Jungle service; override image/env.
* Docs: `docker compose --profile jungle up -d`.

**Tests**
`/tests/sprint3/compose_config.test.sh` already validates config; add a grep for `profiles: jungle`.

**Accept when**
Config validates and profile appears.

**Plain English**

> One switch to run with a real Jungle locally.

**LLM priming**
`profiles`, `docker compose --profile jungle up`, `depends_on`, `service_healthy`

---

## Ticket-311 — README: Compose quickstart (copy-pasteable)

**What / Why**
Document “one-command run”, env, and example `curl` calls for `/healthz` and `/mcp initialize`.

**Where**
`/README.md`

**Implementation sketch**

* “Quickstart”: `cp deploy/compose.env.example .env && docker compose up -d`
* Example `curl` to `/mcp` with JSON-RPC body; note **Content-Type**.

**Tests**
`/tests/sprint3/readme_compose_quickstart.spec.ts`: grep README for code blocks and required strings.

**Accept when**
Doc exists and commands work as written.

**Plain English**

> Anyone can run this locally in minutes.

**LLM priming**

```
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  http://localhost:8080/mcp
```

---

## Ticket-312 — (Optional K8s placeholder) manifests skeleton

**What / Why**
Create **placeholder** K8s manifests with **readiness/liveness** probes pointing to `/healthz`. They won’t be applied this sprint, but give staging a head start. ([Kubernetes][4])

**Where**
`/deploy/k8s/deployment.yaml`, `/deploy/k8s/service.yaml`

**Implementation sketch**

* Deployment: `readinessProbe` & `livenessProbe` `httpGet: /healthz`, sensible `initialDelaySeconds`.
* Service: expose 8080.

**Tests**
N/A (placeholder YAML lint only if you like).

**Accept when**
YAML is valid (`kubectl kustomize`/`kubectl apply --dry-run=client` later).

**Plain English**

> Prep files for when we deploy to Kubernetes later.

**LLM priming**
`readinessProbe httpGet /healthz`, `livenessProbe`, `initialDelaySeconds` ([Kubernetes][9])

> If you’d rather keep S3 strictly Docker/Compose, you can move Ticket-312 to Sprint 5 when you harden & scale; I left it here as a **skeleton only**.

---

## How to run Sprint 3 tests locally

```bash
# build the image
bash tests/sprint3/docker_build.test.sh

# run the container and verify /healthz
bash tests/sprint3/docker_run_health.test.sh

# validate compose file and bring up the stack
bash tests/sprint3/compose_config.test.sh
bash tests/sprint3/compose_up_health.test.sh
```

---

### Why these priming cues work

They match the exact names/shapes in popular examples and docs — **multi-stage Dockerfile**, **alpine**, **non-root**, **HEALTHCHECK**, **Compose depends_on: service_healthy**, **actions/setup-node cache**, **docker/build-push-action** with **Buildx** and **GHA cache**, **GHCR** tags. That nudges an LLM toward **idiomatic** packaging and CI patterns it has seen repeatedly in high-quality sources. ([Docker Documentation][1])

If you want, I can drop this into `Sprint 3 Overview.md` and generate the stub scripts so `docker build` and `compose config` tests run green immediately.

[1]: https://docs.docker.com/get-started/docker-concepts/building-images/multi-stage-builds/?utm_source=chatgpt.com "Multi-stage builds"
[2]: https://docs.docker.com/reference/compose-file/services/?utm_source=chatgpt.com "Define services in Docker Compose"
[3]: https://docs.github.com/actions/guides/building-and-testing-nodejs?utm_source=chatgpt.com "Building and testing Node.js"
[4]: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/?utm_source=chatgpt.com "Configure Liveness, Readiness and Startup Probes"
[5]: https://docs.docker.com/compose/how-tos/startup-order/?utm_source=chatgpt.com "Control startup and shutdown order with Compose"
[6]: https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry?utm_source=chatgpt.com "Working with the Container registry"
[7]: https://github.com/actions/setup-node?utm_source=chatgpt.com "actions/setup-node"
[8]: https://github.com/docker/build-push-action?utm_source=chatgpt.com "GitHub Action to build and push Docker images with Buildx"
[9]: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/?utm_source=chatgpt.com "Liveness, Readiness, and Startup Probes"
