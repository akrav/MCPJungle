# Epic 3: Sprint Overview

## Summary

| Sprint | Goal | Tasks | Time |
|--------|------|-------|------|
| Sprint 1 | Local Testing & Docker Build | 6 | 1h 30m |
| Sprint 2 | AWS Deployment & Infrastructure | 6 | 1h 30m |
| Sprint 3 | End-to-End Python Testing | 6 | 1h 30m |
| Sprint 4 | Regression Testing & Documentation | 4 | 1h |

**Total Estimated Time:** 5 Hours 30 Minutes

---

## Code Changes Summary

The following changes have been made to the Lambda adapter:

### Dockerfile
- Added `python3`, `python3-pip`, `tar`, `gzip` packages
- Pip upgraded to latest version

### src/index.js
- `downloadAndExtract()`: Now supports `.zip`, `.tar.gz`, `.tgz`, `.mcpb`
- `resolveRuntime()`: New function with 4-tier strategy:
  1. `manifest.json` (Standard MCP Bundle)
  2. `mcp.json` (Custom contract)
  3. Python heuristic (`main.py`, `app.py`, etc.)
  4. Node.js heuristic (`node_modules/.bin`, `package.json`)
- Added `PYTHONUNBUFFERED=1` for proper SSE streaming

### Test Files Created
- `src/index.test.js` - Unit tests for runtime detection
- `test-tools/main.py` - Python MCP test server
- `test-tools/manifest.json` - Standard manifest example
- `test-tools/mcp.json` - Custom contract example

---

## Quick Start

### Run Unit Tests
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda
node --test src/index.test.js
```

### Build Docker Locally
```bash
docker build --platform linux/amd64 -t mcp-adapter:local .
```

### Deploy to AWS
```bash
./scripts/deploy.sh dev
```

---

## Sprint Files

- [Sprint 1: Local Testing & Docker Build](./Sprint_1.md)
- [Sprint 2: AWS Deployment & Infrastructure](./Sprint_2.md)
- [Sprint 3: End-to-End Python Testing](./Sprint_3.md)
- [Sprint 4: Regression Testing & Documentation](./Sprint_4.md)
