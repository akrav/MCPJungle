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
