# Sprint 4: Regression Testing & Documentation

**Goal:** Verify existing Node.js tools still work and document the new features.
**Estimated Time:** 1 Hour (4 x 15-min tasks)
**Status:** ✅ COMPLETED (February 15, 2026)
**Dependencies:** Sprint 3 Complete

---

## Pre-requisites
- Sprint 3 completed (Python tools working)
- Access to an existing Node.js MCP tool package

---

## TICKET-401: Verify Node.js Legacy Tool Still Works [~15 min]

### Objective
Confirm backward compatibility - existing Node.js tools must continue to work.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get values
LAMBDA_URL=$(terraform output -raw lambda_function_url)
BUCKET=$(terraform output -raw artifact_bucket_name)

# Check if an existing Node.js tool exists in S3
aws s3 ls "s3://$BUCKET/packages/" --recursive | head -20

# If you have a Node.js tool (e.g., context7), test it:
# Replace 'context7' with your actual tool name
TOOL_NAME="context7"  # CHANGE THIS
TOOL_VERSION="latest"

curl -X POST "${LAMBDA_URL}?tool=${TOOL_NAME}&version=${TOOL_VERSION}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  -w "\n\nHTTP Status: %{http_code}\n"
```

### Expected Output
- HTTP 200 response
- SSE stream with JSON-RPC response
- CloudWatch shows Node.js binary execution (not python3)

### Verification Checklist
- [x] Node.js tool `context7` responds successfully (v2.0.2)
- [x] No regression in functionality
- [x] CloudWatch logs show `node_modules/.bin/context7-mcp` path

---

## TICKET-402: Create Simple Node.js Test Tool [~15 min]

### Objective
Create a minimal Node.js MCP tool to test the Node heuristics.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get S3 bucket
BUCKET=$(terraform output -raw artifact_bucket_name)

# Create package directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Create package.json
cat > package.json << 'EOF'
{
  "name": "node-test-mcp",
  "version": "1.0.0",
  "main": "index.js"
}
EOF

# Create index.js
cat > index.js << 'EOF'
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('Node.js MCP Test Server started');

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    const response = {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "node-mcp-test", version: "1.0.0" }
      }
    };
    console.log(JSON.stringify(response));
  } catch (e) {
    console.error('Parse error:', e.message);
  }
});
EOF

# Create zip
zip -r node-test.zip package.json index.js

# Upload
aws s3 cp node-test.zip "s3://$BUCKET/packages/node-test/1.0.0.zip"

# Cleanup
rm -rf "$TEMP_DIR"
```

### Verification Checklist
- [x] Node.js test package created (762 bytes)
- [x] Uploaded to S3 successfully

---

## TICKET-403: Test Node.js Heuristic [~15 min]

### Objective
Verify the Node.js heuristic (package.json + index.js) works.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get Lambda URL
LAMBDA_URL=$(terraform output -raw lambda_function_url)

# Invoke
curl -X POST "${LAMBDA_URL}?tool=node-test&version=1.0.0" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  -w "\n\nHTTP Status: %{http_code}\n"
```

### Expected Output
- HTTP 200 response
- CloudWatch shows: `Spawning tool process ... command: node`
- Response contains `serverInfo.name: "node-mcp-test"`

### Verification Checklist
- [x] HTTP 200 response
- [x] Node.js heuristic used (`command: node`, `args: ["/tmp/.../index.js"]`)
- [x] Response shows `serverInfo.name: "node-mcp-test"`

---

## TICKET-404: Update Documentation [~15 min]

### Objective
Update the project documentation with the new polyglot features.

### Documentation Updates
1. **README.md** - Add supported languages section
2. **Packaging Guide** - How to package Python/Node/Binary tools

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# View current README
cat README.md
```

### Documentation Template (add to README.md)
```markdown
## Supported Languages

The Lambda adapter supports the following languages:

| Language | Detection Method | Requirements |
|----------|-----------------|--------------|
| Python | `main.py`, `app.py`, `index.py` | Python 3.11+ installed in image |
| Node.js | `package.json` + `node_modules/.bin` | Node.js 20 installed |
| Binary (Go/Rust) | `manifest.json` with `type: binary` | Linux AMD64 binary |

## Manifest Files

### manifest.json (MCP Bundle Standard)
```json
{
  "server": {
    "type": "python",
    "command": "python3",
    "args": ["main.py"]
  }
}
```

### mcp.json (Custom)
```json
{
  "runtime": "python",
  "executable": "main.py",
  "args": []
}
```
```

### Verification Checklist
- [x] Documentation reviewed
- [x] Supported languages documented (Python, Node.js, Binary)
- [x] Manifest examples provided (manifest.json and mcp.json)

---

## Sprint 4 Completion Checklist

| Ticket | Description | Time | Status |
|--------|-------------|------|--------|
| TICKET-401 | Verify Legacy Node.js | 15 min | [x] PASSED |
| TICKET-402 | Create Node.js Test Tool | 15 min | [x] PASSED |
| TICKET-403 | Test Node.js Heuristic | 15 min | [x] PASSED |
| TICKET-404 | Update Documentation | 15 min | [x] PASSED |

**Sprint Complete:** [x] Completed February 15, 2026

---

## Epic 3 Final Checklist

After completing all 4 sprints, verify:

- [x] **Python Support**: Python MCP servers execute correctly (tested with python-heuristic, python-manifest, python-custom)
- [x] **Manifest Support**: manifest.json arguments are passed (`--manifest-test` verified in CloudWatch)
- [x] **Custom Contract**: mcp.json arguments are passed (`--custom-test` verified in CloudWatch)
- [x] **Heuristics Work**: Tools without manifests auto-detect (Python via main.py, Node.js via package.json+index.js)
- [x] **No Regression**: Existing Node.js tools still work (context7 v2.0.2 tested)
- [x] **Compression**: Both .zip and .tar.gz work (verified in Sprint 3)
- [x] **Documentation**: README.md updated with polyglot features

**Epic 3 Complete:** [x] Completed February 15, 2026
