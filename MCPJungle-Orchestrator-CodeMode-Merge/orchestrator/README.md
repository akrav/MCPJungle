# Orchestrator

The Orchestrator is the intelligent routing layer for MCPJungle, handling:

- **Request Routing** - Direct requests to the right Jungle instance
- **Tool Discovery** - Find and install MCP tools on-demand
- **Code Mode** - Safely execute AI-generated code
- **Lambda Integration** - Run MCP tools on AWS Lambda

---

## Quick Start

### Code Mode

```bash
# Ensure JUNGLE_URL points to your Jungle
export JUNGLE_URL=http://localhost:9000

# Optional verbose logs
export CODEMODE_VERBOSE_LOGS=true
export CODEMODE_LOG_DIR=./logs

# Run the live script
npm run codemode:live
```

Expected: JSON printed with `{ id, docs }` fields.

### Lambda Mode

The Lambda infrastructure is deployed and operational:

| Resource | Value |
|----------|-------|
| **Lambda URL** | `https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/` |
| **S3 Bucket** | `mcp-tools-20260121000919294600000001` |

```bash
# Configure Lambda
export PROVISIONER=lambda
export AWS_LAMBDA_FUNCTION_URL=https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/
export AWS_LAMBDA_S3_BUCKET=mcp-tools-20260121000919294600000001

# Start orchestrator
npm run dev
```

**Quick Test:**
```bash
curl -X POST "https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/?tool=context7&version=latest" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```

See [Lambda Documentation](docs/lambda/README.md) for full setup guide.

---

## Operator Runbook

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `ROUTING_MODE` | `shared`, `per_user` | `shared` | Routing strategy |
| `PROVISIONER` | `none`, `docker`, `k8s`, `lambda` | `none` | Backend provisioner |
| `PROVISION_ON_DEMAND` | `true`, `false` | `false` | Auto-provision instances |
| `JUNGLE_HEALTH_TIMEOUT_MS` | number | `5000` | Health check timeout |
| `JUNGLE_HEALTH_BACKOFF_MS` | number | `1000` | Health check backoff |

### Lambda-Specific Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region |
| `AWS_LAMBDA_FUNCTION_URL` | Yes | Lambda Function URL |
| `AWS_LAMBDA_S3_BUCKET` | Yes | S3 bucket for packages |
| `LAMBDA_MEMORY_MB` | No | Memory allocation (default: 1024) |
| `LAMBDA_TIMEOUT_MS` | No | Timeout in ms (default: 30000) |

### Logs

- Code Mode traces: `${CODEMODE_LOG_DIR}/codemode-run-<runId>.log` (when verbose enabled)
- Lambda logs: CloudWatch `/aws/lambda/mcpjungle-adapter`

---

## Production Guidance

### Shared vs Per-user

- **Shared (default)**: Lower cost, warm caches, simpler ops. Best for most users.
- **Per-user**: Use for sensitive data, private MCP configs/keys, noisy/expensive jobs, or strict SLOs.

### Dynamic Routing

1. Store a per-user policy in your DB (`shared` or `per_user`)
2. Router selects shared or provisions per-user on demand
3. Health-checks instances; garbage collects idle ones

### Provisioner Options

| Provisioner | Use Case | Notes |
|-------------|----------|-------|
| `none` | Development | No auto-provisioning |
| `docker` | Staging | Local container isolation |
| `k8s` | Production | Kubernetes-based isolation |
| `lambda` | Serverless | AWS Lambda-based execution |

### MCP Subscriptions

1. Users enable MCPs in your UI
2. Register those MCP endpoints into the selected registry
3. Calls include `x-user-id`; orchestrator routes accordingly
4. Code Mode runs with that user context

### Security & Ops

- **Secrets**: Per-user secrets via K8s Secrets or AWS Secrets Manager
- **Rate Limits**: Per-tenant rate limits and quotas
- **Logging**: Structured logs with userId/runId
- **Cost Controls**: Idle timeouts, backpressure, safe defaults

---

## Documentation

| Document | Description |
|----------|-------------|
| [Lambda Setup](docs/lambda/SETUP.md) | Deploy Lambda infrastructure |
| [Lambda Packaging](docs/lambda/PACKAGING.md) | Package MCP tools |
| [Lambda API](docs/lambda/API.md) | API reference |
| [Lambda Runbook](docs/lambda/RUNBOOK.md) | Operations guide |

---

## Testing

```bash
# Run all tests
npm test

# Run Lambda tests only
npm test -- tests/lambda/

# Run with coverage
npm run test:coverage
```

---

*Last Updated: January 13, 2026*


