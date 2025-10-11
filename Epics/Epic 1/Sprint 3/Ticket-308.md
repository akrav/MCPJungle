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
