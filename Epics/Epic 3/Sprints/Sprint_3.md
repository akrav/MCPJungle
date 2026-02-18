# Sprint 3: End-to-End Python Testing

**Goal:** Verify Python MCP servers work end-to-end on AWS Lambda.
**Estimated Time:** 1 Hour 30 Minutes (6 x 15-min tasks)
**Status:** ✅ COMPLETED (February 15, 2026)
**Dependencies:** Sprint 2 Complete

---

## Pre-requisites
- Sprint 2 completed (Lambda deployed)
- AWS CLI configured
- `zip` and `tar` utilities available

---

## TICKET-301: Package Python Tool (Heuristic Mode) [~15 min]

### Objective
Create a Python package WITHOUT any manifest to test heuristic detection.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get S3 bucket
BUCKET=$(terraform output -raw artifact_bucket_name)
echo "S3 Bucket: $BUCKET"

# Create package directory
TEMP_DIR=$(mktemp -d)
cp "/Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3/Sprints/test-tools/main.py" "$TEMP_DIR/"

# Create tar.gz (NO manifest - testing heuristic)
cd "$TEMP_DIR"
tar -czf python-heuristic.tar.gz main.py

# Upload to S3
aws s3 cp python-heuristic.tar.gz "s3://$BUCKET/packages/python-heuristic/1.0.0.tar.gz"

# Verify upload
aws s3 ls "s3://$BUCKET/packages/python-heuristic/"

# Cleanup
rm -rf "$TEMP_DIR"
```

### Expected Output
- File uploaded: `s3://<bucket>/packages/python-heuristic/1.0.0.tar.gz`
- S3 listing shows the file

### Verification Checklist
- [x] tar.gz created with only main.py
- [x] Uploaded to S3 successfully
- [x] S3 listing confirms file exists (1529 bytes)

---

## TICKET-302: Test Python Heuristic Detection [~15 min]

### Objective
Invoke Lambda with the heuristic package and verify Python executes.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get Lambda URL
LAMBDA_URL=$(terraform output -raw lambda_function_url)

# Invoke with initialize request
curl -X POST "${LAMBDA_URL}?tool=python-heuristic&version=1.0.0" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  -w "\n\nHTTP Status: %{http_code}\n"

# Check CloudWatch logs
LOG_GROUP="/aws/lambda/$(terraform output -raw lambda_function_name)"
echo "Check logs at: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/${LOG_GROUP}"
```

### Expected Output (SSE Format)
```
event: message
data: {"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2024-11-05", ...}}

HTTP Status: 200
```

### CloudWatch Logs Should Show
- `Extracting package ... format: .tar.gz`
- `Spawning tool process ... command: python3`

### Verification Checklist
- [x] HTTP 200 response
- [x] SSE stream contains JSON-RPC response
- [x] CloudWatch shows `.tar.gz` extraction
- [x] CloudWatch shows `python3` command with heuristic args

---

## TICKET-303: Package Python Tool (manifest.json) [~15 min]

### Objective
Create a Python package WITH manifest.json to test standard MCP Bundle format.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get S3 bucket
BUCKET=$(terraform output -raw artifact_bucket_name)

# Create package directory
TEMP_DIR=$(mktemp -d)
cp "/Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3/Sprints/test-tools/main.py" "$TEMP_DIR/"
cp "/Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3/Sprints/test-tools/manifest.json" "$TEMP_DIR/"

# Verify manifest content
echo "=== manifest.json ==="
cat "$TEMP_DIR/manifest.json"
echo ""

# Create zip
cd "$TEMP_DIR"
zip -r python-manifest.zip main.py manifest.json

# Upload to S3
aws s3 cp python-manifest.zip "s3://$BUCKET/packages/python-manifest/1.0.0.zip"

# Verify
aws s3 ls "s3://$BUCKET/packages/python-manifest/"

# Cleanup
rm -rf "$TEMP_DIR"
```

### Expected Output
- manifest.json shows `--manifest-test` in args
- File uploaded to S3

### Verification Checklist
- [x] Package includes manifest.json
- [x] manifest.json has `--manifest-test` argument
- [x] Uploaded to S3 successfully (1690 bytes)

---

## TICKET-304: Test manifest.json Execution [~15 min]

### Objective
Verify manifest.json arguments are passed to the Python script.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get Lambda URL
LAMBDA_URL=$(terraform output -raw lambda_function_url)

# Invoke
curl -X POST "${LAMBDA_URL}?tool=python-manifest&version=1.0.0" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  -w "\n\nHTTP Status: %{http_code}\n"

# Check CloudWatch for the --manifest-test flag
echo "Check CloudWatch logs for: MANIFEST.JSON strategy detected"
```

### Expected Output
- HTTP 200 response
- CloudWatch logs show: `MANIFEST.JSON strategy detected via --manifest-test flag`
- CloudWatch logs show: `Spawning tool process ... args: ["main.py", "--manifest-test"]`

### Verification Checklist
- [x] HTTP 200 response
- [x] JSON-RPC response received
- [x] CloudWatch shows `args: ["main.py", "--manifest-test"]`
- [x] CloudWatch shows "MANIFEST.JSON strategy detected via --manifest-test flag"

---

## TICKET-305: Package Python Tool (mcp.json) [~15 min]

### Objective
Create a Python package with mcp.json to test custom contract format.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get S3 bucket
BUCKET=$(terraform output -raw artifact_bucket_name)

# Create package directory
TEMP_DIR=$(mktemp -d)
cp "/Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3/Sprints/test-tools/main.py" "$TEMP_DIR/"
cp "/Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3/Sprints/test-tools/mcp.json" "$TEMP_DIR/"

# Verify mcp.json content
echo "=== mcp.json ==="
cat "$TEMP_DIR/mcp.json"
echo ""

# Create zip
cd "$TEMP_DIR"
zip -r python-custom.zip main.py mcp.json

# Upload to S3
aws s3 cp python-custom.zip "s3://$BUCKET/packages/python-custom/1.0.0.zip"

# Cleanup
rm -rf "$TEMP_DIR"
```

### Expected Output
- mcp.json shows `--custom-test` in args
- File uploaded to S3

### Verification Checklist
- [x] Package includes mcp.json
- [x] mcp.json has `--custom-test` argument
- [x] Uploaded to S3 successfully (1604 bytes)

---

## TICKET-306: Test mcp.json Execution [~15 min]

### Objective
Verify mcp.json arguments are passed to the Python script.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get Lambda URL
LAMBDA_URL=$(terraform output -raw lambda_function_url)

# Invoke
curl -X POST "${LAMBDA_URL}?tool=python-custom&version=1.0.0" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  -w "\n\nHTTP Status: %{http_code}\n"

# Check CloudWatch for the --custom-test flag
echo "Check CloudWatch logs for: MCP.JSON strategy detected"
```

### Expected Output
- HTTP 200 response
- CloudWatch logs show: `MCP.JSON strategy detected via --custom-test flag`

### Verification Checklist
- [x] HTTP 200 response
- [x] JSON-RPC response received
- [x] CloudWatch shows `args: ["main.py", "--custom-test"]`
- [x] CloudWatch shows "MCP.JSON strategy detected via --custom-test flag"

---

## Sprint 3 Completion Checklist

| Ticket | Description | Time | Status |
|--------|-------------|------|--------|
| TICKET-301 | Package Heuristic Tool | 15 min | [x] PASSED |
| TICKET-302 | Test Heuristic Detection | 15 min | [x] PASSED |
| TICKET-303 | Package manifest.json Tool | 15 min | [x] PASSED |
| TICKET-304 | Test manifest.json | 15 min | [x] PASSED |
| TICKET-305 | Package mcp.json Tool | 15 min | [x] PASSED |
| TICKET-306 | Test mcp.json | 15 min | [x] PASSED |

**Sprint Complete:** [x] Completed February 15, 2026
