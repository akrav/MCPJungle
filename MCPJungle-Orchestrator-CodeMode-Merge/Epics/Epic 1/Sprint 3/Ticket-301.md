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
