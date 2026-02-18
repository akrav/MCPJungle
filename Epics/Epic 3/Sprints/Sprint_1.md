# Sprint 1: Local Testing & Docker Build

**Goal:** Verify the updated code works locally before deploying to AWS.
**Estimated Time:** 1 Hour 30 Minutes (6 x 15-min tasks)
**Status:** ✅ COMPLETED (February 15, 2026)

---

## Pre-requisites
- Node.js 20+ installed (`node --version`)
- Docker installed and running (`docker --version`)
- Python 3 installed (`python3 --version`)

---

## TICKET-101: Run Unit Tests Locally [~15 min]

### Objective
Verify the `resolveRuntime` logic correctly detects different package types.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Run the unit tests
node --test src/index.test.js
```

### Expected Output
```
✔ resolveRuntime > should resolve runtime from manifest.json with command
✔ resolveRuntime > should resolve runtime from mcp.json
✔ resolveRuntime > should detect Python via main.py heuristic
✔ File Format Detection > should identify .zip files
✔ Extraction Commands > should extract .zip files correctly
...
```

### Verification Checklist
- [x] All tests pass (16/16)
- [x] No errors in console

---

## TICKET-102: Test Python MCP Server Locally [~15 min]

### Objective
Verify the Python test server responds correctly to MCP protocol.

### Commands
```bash
cd "/Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3/Sprints/test-tools"

# Test initialize
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python3 main.py

# Test tools/list
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | python3 main.py

# Test with --manifest-test flag
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python3 main.py --manifest-test

# Test with --custom-test flag
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python3 main.py --custom-test
```

### Expected Output (initialize)
```json
{"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2024-11-05", "capabilities": {"tools": {"listChanged": false}}, "serverInfo": {"name": "python-mcp-test", "version": "1.0.0"}}}
```

### Verification Checklist
- [x] `initialize` returns valid JSON-RPC response
- [x] `tools/list` returns tool definitions
- [x] `--manifest-test` flag logs "MANIFEST.JSON strategy detected"
- [x] `--custom-test` flag logs "MCP.JSON strategy detected"

---

## TICKET-103: Build Docker Image Locally [~15 min]

### Objective
Build the "Mega-Image" Docker container with Python/tar support.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Build the image for AMD64 (Lambda architecture)
docker build --platform linux/amd64 -t mcp-adapter:local .

# Check image size
docker images mcp-adapter:local
```

### Expected Output
- Build completes without errors
- Image size should be ~500-800MB

### Verification Checklist
- [x] Docker build succeeded
- [x] Image created successfully (144MB)

---

## TICKET-104: Verify Docker Image Has Python [~15 min]

### Objective
Confirm Python 3 is available inside the container.

### Commands
```bash
# Verify Python is installed
docker run --rm mcp-adapter:local python3 --version

# Verify pip is installed
docker run --rm mcp-adapter:local pip3 --version

# Verify tar/gzip are installed
docker run --rm mcp-adapter:local tar --version
docker run --rm mcp-adapter:local gzip --version

# List installed dnf packages
docker run --rm mcp-adapter:local dnf list installed | grep -E "python|tar|gzip|unzip"
```

### Expected Output
```
Python 3.11.x (or similar)
pip 23.x.x
tar (GNU tar) 1.x
gzip 1.x
```

### Verification Checklist
- [x] `python3 --version` shows Python 3.9.25
- [x] `tar --version` shows GNU tar 1.34
- [x] `gzip --version` shows gzip 1.12

---

## TICKET-105: Test Python Inside Docker [~15 min]

### Objective
Run the Python MCP server inside the Docker container.

### Commands
```bash
# Copy test files to a temp directory
TEMP_DIR=$(mktemp -d)
cp "/Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3/Sprints/test-tools/main.py" "$TEMP_DIR/"

# Run Python inside Docker
docker run --rm -v "$TEMP_DIR:/test" mcp-adapter:local \
  /bin/bash -c 'echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}" | python3 /test/main.py'

# Cleanup
rm -rf "$TEMP_DIR"
```

### Expected Output
```json
{"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2024-11-05", ...}}
```

### Verification Checklist
- [x] Python script runs inside Docker
- [x] JSON-RPC response is valid

---

## TICKET-106: Test Package Extraction in Docker [~15 min]

### Objective
Verify the container can extract both .zip and .tar.gz files.

### Commands
```bash
# Create test packages
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Create source files
mkdir src
echo "print('hello')" > src/main.py

# Create .zip
zip -r test.zip src/

# Create .tar.gz
tar -czf test.tar.gz src/

# Test zip extraction
docker run --rm -v "$TEMP_DIR:/test" mcp-adapter:local \
  /bin/bash -c 'mkdir /tmp/extracted-zip && unzip -o -q /test/test.zip -d /tmp/extracted-zip && ls /tmp/extracted-zip/'

# Test tar.gz extraction
docker run --rm -v "$TEMP_DIR:/test" mcp-adapter:local \
  /bin/bash -c 'mkdir /tmp/extracted-tar && tar -xzf /test/test.tar.gz -C /tmp/extracted-tar && ls /tmp/extracted-tar/'

# Cleanup
rm -rf "$TEMP_DIR"
```

### Expected Output
Both commands should show: `src`

### Verification Checklist
- [x] .zip extraction works
- [x] .tar.gz extraction works

---

## Sprint 1 Completion Checklist

| Ticket | Description | Time | Status |
|--------|-------------|------|--------|
| TICKET-101 | Run Unit Tests | 15 min | [x] PASSED - 16/16 tests |
| TICKET-102 | Test Python Server | 15 min | [x] PASSED |
| TICKET-103 | Build Docker Image | 15 min | [x] PASSED - 144MB |
| TICKET-104 | Verify Python in Docker | 15 min | [x] PASSED - Python 3.9.25 |
| TICKET-105 | Test Python in Docker | 15 min | [x] PASSED |
| TICKET-106 | Test Extraction | 15 min | [x] PASSED |

**Sprint Complete:** [x] Completed February 15, 2026
