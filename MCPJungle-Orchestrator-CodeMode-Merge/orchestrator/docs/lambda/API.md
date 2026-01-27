# Lambda API Reference

> Technical reference for the MCPJungle Lambda adapter API.

---

## Endpoint

**Production URL:**
```
https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/
```

**Format:**
```
POST https://{function-url-id}.lambda-url.{region}.on.aws?tool={tool}&version={version}
```

### Query Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `tool` | Yes | - | Name of the MCP tool to invoke |
| `version` | No | `latest` | Version of the tool package |

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |

### Request Body

JSON-RPC 2.0 request:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "method": "method-name",
  "params": {}
}
```

### Response

Server-Sent Events (SSE) stream:

```
event: message
data: {"jsonrpc":"2.0","id":"request-id","result":{...}}

```

### Response Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `text/event-stream` |
| `X-Cold-Start` | `true` or `false` |
| `X-Tool-Name` | Name of the invoked tool |
| `X-Tool-Version` | Version of the tool |

---

## Methods

### initialize

Initialize the MCP connection.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": "init-1",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "mcpjungle",
      "version": "1.0.0"
    }
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": "init-1",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "context7",
      "version": "1.0.0"
    }
  }
}
```

---

### tools/list

List available tools from the MCP server.

**Request:**

```bash
curl -X POST "https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/?tool=context7&version=latest" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"list-1","method":"tools/list"}'
```

```json
{
  "jsonrpc": "2.0",
  "id": "list-1",
  "method": "tools/list"
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": "list-1",
  "result": {
    "tools": [
      {
        "name": "resolve-library-id",
        "description": "Resolves a library name to its Context7 ID",
        "inputSchema": {
          "type": "object",
          "properties": {
            "libraryName": {
              "type": "string",
              "description": "Library name to search for"
            }
          },
          "required": ["libraryName"]
        }
      },
      {
        "name": "query-docs",
        "description": "Gets documentation for a library",
        "inputSchema": {
          "type": "object",
          "properties": {
            "libraryId": {
              "type": "string"
            },
            "query": {
              "type": "string"
            }
          },
          "required": ["libraryId", "query"]
        }
      }
    ]
  }
}
```

---

### tools/call

Call a specific tool.

**Request:**

```bash
curl -X POST "https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/?tool=context7&version=latest" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"call-123","method":"tools/call","params":{"name":"resolve-library-id","arguments":{"libraryName":"react","query":"hooks"}}}'
```

```json
{
  "jsonrpc": "2.0",
  "id": "call-123",
  "method": "tools/call",
  "params": {
    "name": "resolve-library-id",
    "arguments": {
      "libraryName": "react",
      "query": "hooks"
    }
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": "call-123",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"libraryId\":\"/facebook/react\",\"name\":\"React\"}"
      }
    ]
  }
}
```

---

## Error Responses

### Missing Tool Parameter

```json
{
  "error": "Missing 'tool' query parameter"
}
```

HTTP Status: `400`

### Tool Package Not Found

```json
{
  "error": "Could not download package for tool 'unknown-tool'"
}
```

HTTP Status: `404`

### Binary Not Found

```json
{
  "error": "Could not find binary for tool 'broken-tool'"
}
```

HTTP Status: `500`

### JSON-RPC Error

```json
{
  "jsonrpc": "2.0",
  "id": "call-123",
  "error": {
    "code": -32601,
    "message": "Method not found: unknown/method"
  }
}
```

### Timeout Error

```json
{
  "error": "Tool execution timed out after 30000ms"
}
```

HTTP Status: `504`

---

## TypeScript Client

### LambdaMcpClient

```typescript
import { LambdaMcpClient } from './discovery/provisioning/lambdaClient.js';

// Create client
const client = new LambdaMcpClient(
  'https://abc123.lambda-url.us-east-1.on.aws',
  'context7',
  'latest'
);

// Initialize
const initResult = await client.initialize();
// { success: true, response: {...}, durationMs: 150, isColdStart: true }

// List tools
const listResult = await client.listTools();
// { success: true, response: {...}, durationMs: 50, isColdStart: false }

// Call tool
const callResult = await client.callTool('resolve-library-id', {
  libraryName: 'react'
});
// { success: true, response: {...}, durationMs: 200, isColdStart: false }
```

### LambdaMcpClient Methods

| Method | Parameters | Returns |
|--------|------------|---------|
| `initialize()` | - | `Promise<LambdaInvokeResult>` |
| `listTools()` | - | `Promise<LambdaInvokeResult>` |
| `callTool(name, args)` | `string`, `object` | `Promise<LambdaInvokeResult>` |
| `sendRawRequest(method, params?)` | `string`, `object?` | `Promise<LambdaInvokeResult>` |

### LambdaInvokeResult

```typescript
interface LambdaInvokeResult {
  success: boolean;
  response?: JsonRpcResponse;
  error?: string;
  durationMs: number;
  isColdStart: boolean;
}
```

---

## Health Check

Check if a Lambda endpoint is healthy:

```typescript
import { isLambdaHealthy } from './discovery/provisioning/lambdaClient.js';

const healthy = await isLambdaHealthy(
  'https://abc123.lambda-url.us-east-1.on.aws'
);
// true or false
```

A health check makes a GET request and considers the endpoint healthy if it returns:
- HTTP 200 (healthy)
- HTTP 400 (healthy but missing tool param)

Any other status or connection error returns `false`.

---

## Go Client

### Lambda Transport

```go
import "MCPJungle/internal/service/mcp"

// Create connection
conn, err := mcp.CreateLambdaMcpServerConn(ctx, &model.McpServer{
    Name:      "context7",
    Transport: types.TransportLambda,
    Config:    []byte(`{"function_url":"https://...","tool_name":"context7"}`),
})

// Use the connection
resp, err := conn.CallTool(ctx, "resolve-library-id", map[string]any{
    "libraryName": "react",
})
```

---

## Rate Limits

The Lambda adapter inherits AWS Lambda's limits:

| Limit | Value |
|-------|-------|
| Concurrent executions | 1,000 (default, can increase) |
| Request payload | 6 MB |
| Response payload | 6 MB (streaming unlimited) |
| Timeout | Configurable (max 15 minutes) |

---

## Related Documentation

- [Lambda Setup Guide](SETUP.md)
- [Tool Packaging Guide](PACKAGING.md)
- [Runbook](RUNBOOK.md)

---

*Last Updated: January 13, 2026*
