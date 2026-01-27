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
