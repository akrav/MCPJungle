# E2E Test Report

Generated: 2025-10-30T20:45:39.457Z

## Register sample server

**Input**
```json
{
  "name": "sample",
  "transport": "streamable_http",
  "description": "E2E Sample server",
  "url": "http://host.docker.internal:64282/mcp"
}
```

**Expected**
```json
{
  "status": 201
}
```
**Actual**
```json
{
  "status": 201,
  "body": {
    "ID": 1,
    "CreatedAt": "2025-10-30T20:45:39.963228049Z",
    "UpdatedAt": "2025-10-30T20:45:39.963228049Z",
    "DeletedAt": null,
    "name": "sample",
    "transport": "streamable_http",
    "description": "E2E Sample server",
    "config": {
      "url": "http://host.docker.internal:64282/mcp"
    }
  }
}
```

Result: PASS

---
## tools/list via orchestrator

**Input**
```json
{
  "jsonrpc": "2.0",
  "id": "l1",
  "method": "tools/list"
}
```

**Expected**
```json
{
  "toolsInclude": [
    "codemode__executeCodeWithTools",
    "codemode__listAvailableTools",
    "sample__calculate"
  ]
}
```
**Actual**
```json
{
  "status": 200,
  "names": [
    "sample__calculate",
    "sample__getDateTime",
    "codemode__executeCodeWithTools",
    "codemode__listAvailableTools"
  ]
}
```

Result: PASS

---
## Type generation input

**Input**
```json
[
  "sample__calculate",
  "sample__getDateTime",
  "codemode__executeCodeWithTools",
  "codemode__listAvailableTools"
]
```

**Expected**
```json
{
  "contains": [
    "sample__calculate",
    "sample__getDateTime"
  ]
}
```
**Actual**
```json
{
  "compiled": true
}
```

Result: PASS

---
## executeCodeWithTools

**Input**
```json
{
  "code": "const a = await tools[\"sample__calculate\"]({ expression: \"2+3\" }); const t = await tools[\"sample__getDateTime\"]({}); return { sum: a.result, ts: t.timestamp };"
}
```

**Expected**
```json
{
  "success": true,
  "result": {
    "sum": 5
  }
}
```
**Actual**
```json
{
  "success": true,
  "result": {
    "sum": 5,
    "ts": 1761857141606
  },
  "executionTime": 31
}
```

Result: PASS

---
## canonical access (bracket)

**Input**
```json
{
  "code": "return await tools[\"sample__calculate\"]({ expression: \"10-4\" });"
}
```

**Expected**
```json
{
  "result": 6
}
```
**Actual**
```json
{
  "success": true,
  "result": {
    "result": 6
  },
  "executionTime": 11
}
```

Result: PASS

---
## invalid args

**Input**
```json
{
  "code": "return await tools[\"sample__calculate\"]({ expression: 123 });"
}
```

**Expected**
```json
{
  "isError": true
}
```
**Actual**
```json
{
  "wire": {
    "isError": true,
    "content": [
      {
        "type": "text",
        "text": "{\n  \"success\": false,\n  \"executionTime\": 10\n}"
      }
    ]
  },
  "parsed": {
    "success": false,
    "executionTime": 10
  }
}
```

Result: PASS

---
## timeout

**Input**
```json
{
  "limitMs": 500,
  "code": "const t = Date.now()+2000; while(Date.now()<t){}; return { done: true };"
}
```

**Expected**
```json
{
  "isError": true
}
```
**Actual**
```json
{
  "wire": {
    "isError": true,
    "content": [
      {
        "type": "text",
        "text": "{\n  \"success\": false,\n  \"executionTime\": 536\n}"
      }
    ]
  },
  "parsed": {
    "success": false,
    "executionTime": 536
  }
}
```

Result: PASS

---
