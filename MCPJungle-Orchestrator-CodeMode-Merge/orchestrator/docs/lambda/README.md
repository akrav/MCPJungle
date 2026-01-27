# Lambda Integration Documentation

> Documentation for the MCPJungle Lambda integration, enabling serverless MCP tool execution on AWS.

---

## Live Deployment

The Lambda infrastructure is deployed and operational:

| Resource | Value |
|----------|-------|
| **Lambda URL** | `https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/` |
| **Lambda Function** | `mcpjungle-mcp-launcher` |
| **S3 Bucket** | `mcp-tools-20260121000919294600000001` |
| **ECR Repository** | `729387880063.dkr.ecr.us-east-1.amazonaws.com/mcpjungle-mcp-dynamic-adapter` |
| **Region** | `us-east-1` |
| **Memory** | 2048 MB |
| **Timeout** | 900 seconds (15 minutes) |

### Quick Test

```bash
# List tools from context7
curl -X POST "https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/?tool=context7&version=latest" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'

# Call a tool
curl -X POST "https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/?tool=context7&version=latest" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"resolve-library-id","arguments":{"libraryName":"react","query":"hooks"}}}'
```

---

## Overview

The Lambda integration allows MCPJungle to execute MCP tools on AWS Lambda, providing:

- **Serverless Execution** - No servers to manage
- **Dynamic Tool Loading** - Tools loaded on-demand from S3
- **Per-User Isolation** - Optional isolated environments
- **Cost Efficiency** - Pay only for execution time
- **Auto-Scaling** - Handle traffic spikes automatically

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Setup Guide](SETUP.md) | Deploy Lambda infrastructure on AWS |
| [Packaging Guide](PACKAGING.md) | Package MCP tools for Lambda |
| [API Reference](API.md) | Lambda endpoint API documentation |
| [Runbook](RUNBOOK.md) | Operations and incident response |

---

## Quick Links

### Getting Started

1. [Prerequisites](SETUP.md#prerequisites)
2. [Quick Start](SETUP.md#quick-start)
3. [Deploy Infrastructure](SETUP.md#2-deploy-infrastructure)

### Common Tasks

- [Package a Tool](PACKAGING.md#quick-start)
- [Call the Lambda API](API.md#endpoint)
- [Health Check](RUNBOOK.md#health-check)

### Troubleshooting

- [Common Issues](SETUP.md#troubleshooting)
- [Incident Response](RUNBOOK.md#incident-response)
- [Rollback Procedures](RUNBOOK.md#rollback-procedures)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         AI AGENT                                 │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   ORCHESTRATOR                           │    │
│  │                                                          │    │
│  │  LambdaMcpClient  →  HTTP POST  →  Lambda Function URL   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   AWS LAMBDA                              │    │
│  │                                                          │    │
│  │  1. Parse tool name from query params                    │    │
│  │  2. Download package from S3 (cold start only)           │    │
│  │  3. Cache in /tmp                                        │    │
│  │  4. Spawn MCP tool process                               │    │
│  │  5. Stream SSE response                                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   S3 BUCKET                               │    │
│  │                                                          │    │
│  │  packages/                                               │    │
│  │  ├── context7/latest.zip                                 │    │
│  │  ├── filesystem/latest.zip                               │    │
│  │  └── sqlite/v1.0.0.zip                                   │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region |
| `AWS_LAMBDA_FUNCTION_URL` | Yes | Lambda Function URL |
| `AWS_LAMBDA_S3_BUCKET` | Yes | S3 bucket for packages |
| `AWS_LAMBDA_ROLE_ARN` | Yes | Lambda execution role ARN |
| `LAMBDA_MEMORY_MB` | No | Memory allocation (default: 1024) |
| `LAMBDA_TIMEOUT_MS` | No | Timeout in ms (default: 30000) |

---

## Test Results

The Lambda integration includes comprehensive tests:

| Test Suite | Tests | Status |
|------------|-------|--------|
| Unit - lambdaTool.spec.ts | 15 | ✅ |
| Unit - lambdaClient.spec.ts | 17 | ✅ |
| Unit - packaging.spec.ts | 14 | ✅ |
| Integration - tool_call.spec.ts | 11 | ✅ |
| Integration - discovery_flow.spec.ts | 24 | ✅ |
| E2E - full_pipeline.spec.ts | 12 | ✅ |
| **Total** | **93** | **✅ All Pass** |

---

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

---

*Last Updated: January 13, 2026*
