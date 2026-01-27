# Lambda MCP Adapter Integration Plan

> **Status:** Planning  
> **Created:** January 12, 2026  
> **Source:** Clean Dynamic Start → MCPJungle Integration  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Integration Phases](#3-integration-phases)
4. [Detailed Implementation Steps](#4-detailed-implementation-steps)
5. [Dependency Graph](#5-dependency-graph)
6. [Test Matrix](#6-test-matrix)
7. [Risk Mitigation](#7-risk-mitigation)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [Estimated Effort](#9-estimated-effort)
10. [Files Summary](#10-files-summary)

---

## 1. Executive Summary

This document outlines a detailed, step-by-step plan to integrate the **Clean Dynamic Start** Lambda-based MCP adapter into the **MCPJungle-Orchestrator-CodeMode-Merge** codebase. 

The Lambda adapter enables dynamic loading and execution of MCP tools on AWS Lambda, providing:
- **Serverless scalability** - No infrastructure to manage
- **Cold-start caching** - Tools cached in `/tmp` for warm invocations
- **Dynamic tool loading** - Tools fetched from S3 on demand
- **SSE streaming** - Real-time response streaming

---

## 2. Current State Analysis

### 2.1 Clean Dynamic Start Components

| Component | Purpose | Integration Target |
|-----------|---------|-------------------|
| `dynamic_adapter.js` | Lambda handler that downloads MCP packages from S3, spawns tool binaries, streams SSE responses | New transport type in Go service |
| `Dockerfile` | Container image for Lambda (Node.js 20, unzip, lambda-stream) | ECR deployment artifacts |
| `main.tf` | Terraform infrastructure (ECR, S3, Lambda, IAM) | Infrastructure module |
| `deploy.sh` | Build and deploy script | CI/CD pipeline |
| `package_tool.sh` | Creates deployable MCP tool packages | Tool packaging utility |
| `test_client.py` | Python test client for Lambda endpoint | E2E test reference |

### 2.2 Integration Points in MCPJungle

| Location | Current State | Required Change |
|----------|---------------|-----------------|
| `pkg/types/mcp_server.go` | 3 transports: `stdio`, `streamable_http`, `sse` | Add `lambda` transport |
| `internal/service/mcp/util.go` | `newMcpServerSession()` switch | Add Lambda connection handler |
| `orchestrator/src/provisioning/types.ts` | `none`, `docker`, `k8s` | Add `lambda` provisioner |
| `orchestrator/src/config/schema.ts` | No AWS config | Add AWS Lambda config vars |
| `orchestrator/src/discovery/provisioning/installer.ts` | Persists to Supabase | Add Lambda provisioning hook |

### 2.3 How the Lambda Adapter Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAMBDA ADAPTER FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. REQUEST ARRIVES                                                         │
│     POST /?tool=context7&version=latest                                     │
│     Body: { "jsonrpc": "2.0", "method": "initialize", ... }                 │
│                                                                             │
│  2. CACHE CHECK                                                             │
│     Is /tmp/mcp-tools/context7-latest/node_modules/.bin/context7-mcp        │
│     present?                                                                │
│                                                                             │
│     NO (Cold Start):                                                        │
│     ├── Download from S3: packages/context7/latest.zip                      │
│     ├── Unzip to /tmp/mcp-tools/context7-latest/                            │
│     └── chmod +x on binary                                                  │
│                                                                             │
│     YES (Warm Start):                                                       │
│     └── Use cached binary                                                   │
│                                                                             │
│  3. SPAWN SUBPROCESS                                                        │
│     spawn('context7-mcp', [], { stdio: ['pipe', 'pipe', 'pipe'] })          │
│                                                                             │
│  4. PIPE I/O                                                                │
│     └── Write JSON-RPC to stdin                                             │
│     └── Read stdout, wrap in SSE: event: message\ndata: {...}\n\n           │
│                                                                             │
│  5. STREAM RESPONSE                                                         │
│     Content-Type: text/event-stream                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Integration Phases

| Phase | Goal | Tickets | Est. Hours |
|-------|------|---------|------------|
| **Phase 1** | Infrastructure Foundation | 6 | 16 |
| **Phase 2** | Go Transport Layer | 5 | 20 |
| **Phase 3** | Orchestrator Provisioning | 6 | 24 |
| **Phase 4** | Tool Packaging & Management | 4 | 12 |
| **Phase 5** | End-to-End Testing | 8 | 32 |
| **Phase 6** | Documentation | 6 | 12 |
| **Total** | | **35** | **116** |

---

## 4. Detailed Implementation Steps

### Phase 1: Infrastructure Foundation

#### Ticket 1.1: Create Infrastructure Module Directory

**Files to create:**
```
orchestrator/infrastructure/lambda/
├── README.md
├── main.tf
├── variables.tf
└── outputs.tf
```

**Actions:**
1. Create `orchestrator/infrastructure/lambda/` directory
2. Refactor `main.tf` from Clean Dynamic Start into modular Terraform with variables
3. Add configurable parameters: region, memory size, timeout, S3 bucket prefix
4. Add output values for Lambda URL, ECR repo, S3 bucket ARN

---

#### Ticket 1.2: Create Lambda Docker Image Build Pipeline

**Files to create:**
```
orchestrator/infrastructure/lambda/
├── Dockerfile
├── src/index.js
└── .dockerignore
```

**Actions:**
1. Copy Dockerfile from Clean Dynamic Start
2. Copy and rename `dynamic_adapter.js` → `index.js`
3. Add build argument support for custom configurations
4. Create `.dockerignore` for efficient builds

---

#### Ticket 1.3: Create Deployment Scripts

**Files to create:**
```
orchestrator/infrastructure/lambda/scripts/
├── deploy.sh
├── package-tool.sh
└── destroy.sh
```

**Actions:**
1. Adapt `deploy.sh` with error handling and rollback
2. Adapt `package_tool.sh` with validation
3. Create `destroy.sh` for teardown
4. Make all scripts executable and add usage documentation

---

#### Ticket 1.4: Add AWS SDK Dependencies

**Files to modify:**
- `orchestrator/package.json`
- `go.mod` (if AWS SDK needed in Go)

**Dependencies to add:**
```json
{
  "@aws-sdk/client-lambda": "^3.x",
  "@aws-sdk/client-s3": "^3.x",
  "@aws-sdk/client-ecr": "^3.x"
}
```

---

#### Ticket 1.5: Create Environment Variable Schema Extensions

**Files to modify:**
- `orchestrator/src/config/schema.ts`

**New environment variables:**
```typescript
AWS_REGION: z.string().optional(),
AWS_LAMBDA_ROLE_ARN: z.string().optional(),
AWS_LAMBDA_S3_BUCKET: z.string().optional(),
AWS_LAMBDA_ECR_REPO: z.string().optional(),
AWS_LAMBDA_FUNCTION_URL: z.string().url().optional(),
LAMBDA_MEMORY_MB: z.string().optional().transform((v) => 
  v && v.trim() !== '' ? parseInt(v, 10) : 2048
),
LAMBDA_TIMEOUT_MS: z.string().optional().transform((v) => 
  v && v.trim() !== '' ? parseInt(v, 10) : 900000
),
```

---

#### Ticket 1.6: Create AWS Configuration Types

**Files to create:**
- `orchestrator/src/config/aws.ts`

**Contents:**
```typescript
export interface LambdaConfig {
  region: string;
  roleArn: string;
  s3Bucket: string;
  ecrRepo: string;
  functionUrl?: string;
  memoryMb: number;
  timeoutMs: number;
}

export interface S3Config {
  bucket: string;
  region: string;
  packagePrefix: string;
}

export function loadAwsConfig(env: NodeJS.ProcessEnv): LambdaConfig | null;
```

---

### Phase 2: Go Transport Layer

#### Ticket 2.1: Add Lambda Transport Type Constant

**Files to modify:**
- `pkg/types/mcp_server.go`

**Changes:**
```go
const (
    TransportStdio          McpServerTransport = "stdio"
    TransportStreamableHTTP McpServerTransport = "streamable_http"
    TransportSSE            McpServerTransport = "sse"
    TransportLambda         McpServerTransport = "lambda"  // NEW
)

func ValidateTransport(input string) (McpServerTransport, error) {
    // ... existing cases ...
    case string(TransportLambda):
        return TransportLambda, nil
}
```

---

#### Ticket 2.2: Create Lambda Config Model

**Files to create:**
- `internal/model/lambda_config.go`

**Files to modify:**
- `internal/model/mcp_server.go`

**New struct:**
```go
type LambdaConfig struct {
    FunctionURL string `json:"function_url"`
    ToolName    string `json:"tool_name"`
    Version     string `json:"version"`
    Region      string `json:"region,omitempty"`
}
```

---

#### Ticket 2.3: Implement Lambda MCP Client

**Files to create:**
- `internal/service/mcp/lambda.go`

**Key function:**
```go
func createLambdaMcpServerConn(ctx context.Context, s *model.McpServer) (*client.Client, error) {
    // 1. Get Lambda config
    // 2. Build URL with query params: ?tool=<name>&version=<ver>
    // 3. Create HTTP client for SSE
    // 4. Handle SSE response parsing
    // 5. Return wrapped client
}
```

---

#### Ticket 2.4: Integrate Lambda Transport in Session Factory

**Files to modify:**
- `internal/service/mcp/util.go`

**Changes to `newMcpServerSession()`:**
```go
func newMcpServerSession(ctx context.Context, s *model.McpServer) (*client.Client, error) {
    if s.Transport == types.TransportLambda {
        mcpClient, err := createLambdaMcpServerConn(ctx, s)
        if err != nil {
            return nil, fmt.Errorf(
                "failed to create connection to Lambda MCP server %s: %w", s.Name, err,
            )
        }
        return mcpClient, nil
    }
    // ... existing cases ...
}
```

---

#### Ticket 2.5: Add Lambda Server Registration Support

**Files to modify:**
- `internal/api/mcp_servers.go`
- `cmd/register.go`

**New CLI flags:**
```
--transport lambda
--function-url https://xxx.lambda-url.us-east-1.on.aws/
--tool-name context7
--version latest
```

---

### Phase 3: Orchestrator Provisioning

#### Ticket 3.1: Create Lambda Provisioner Interface

**Files to create:**
- `orchestrator/src/provisioning/lambda.ts`

```typescript
import { LambdaClient, CreateFunctionCommand } from '@aws-sdk/client-lambda';
import type { Provisioner } from './types.js';

export class LambdaProvisioner implements Provisioner {
  private client: LambdaClient;
  
  constructor(config: LambdaConfig) {
    this.client = new LambdaClient({ region: config.region });
  }
  
  async provision(userId: string): Promise<{ baseUrl: string }> {
    // Create user-specific Lambda function or return shared URL
  }
  
  async stop(userId: string): Promise<void> {
    // Delete user-specific Lambda if applicable
  }
  
  async isHealthy(baseUrl: string): Promise<boolean> {
    // Ping Lambda function URL
  }
}
```

---

#### Ticket 3.2: Register Lambda Provisioner

**Files to modify:**
- `orchestrator/src/provisioning/types.ts`
- `orchestrator/src/config/schema.ts`

**Changes:**
```typescript
// types.ts
export async function getProvisioner(): Promise<Provisioner> {
  const cfg = loadConfig(process.env);
  switch (cfg.provisioner) {
    case 'lambda': {
      const lambda = await import('./lambda.js');
      return new lambda.LambdaProvisioner(loadAwsConfig(process.env));
    }
    // ... existing cases ...
  }
}

// schema.ts
PROVISIONER: z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v : 'none'))
  .pipe(z.enum(['none', 'docker', 'k8s', 'lambda'])),  // Added 'lambda'
```

---

#### Ticket 3.3: Create Lambda Tool Provisioner

**Files to create:**
- `orchestrator/src/discovery/provisioning/lambdaTool.ts`

**Purpose:** Provision Lambda functions for individual tools (PRIVATE deployment type)

```typescript
export async function provisionToolLambda(
  userId: string,
  tool: InstallableTool,
  metadata: ToolMetadata
): Promise<{ functionArn: string; endpointUrl: string }> {
  // 1. Create Lambda from S3 package
  // 2. Create function URL
  // 3. Return ARN and URL
}
```

---

#### Ticket 3.4: Integrate Lambda in Tool Installer

**Files to modify:**
- `orchestrator/src/discovery/provisioning/installer.ts`

**Add after `persistToolConfig()`:**
```typescript
// Check if tool needs Lambda provisioning
const toolMetadata = await getToolMetadata(tool.id);
if (toolMetadata?.deployment_type === 'PRIVATE') {
  const lambdaResult = await provisionToolLambda(userId, tool, toolMetadata);
  await storeUserLambdaEndpoint(userId, tool.id, lambdaResult);
}
```

---

#### Ticket 3.5: Create Lambda Supabase Schema

**Files to create:**
- `orchestrator/infrastructure/supabase/migrations/xxx_add_lambda_tables.sql`

```sql
-- Tool deployment metadata
CREATE TABLE tool_deployments_orchestrator (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id          UUID REFERENCES tools(id),
  deployment_type  TEXT CHECK (deployment_type IN ('PUBLIC', 'PRIVATE', 'EXTERNAL')),
  s3_bucket        TEXT,
  s3_package_key   TEXT,
  runtime          TEXT DEFAULT 'nodejs20.x',
  handler          TEXT DEFAULT 'index.handler',
  timeout_seconds  INT DEFAULT 30,
  memory_mb        INT DEFAULT 512,
  shared_lambda_arn TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Per-user Lambda instances
CREATE TABLE user_lambda_instances_orchestrator (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  tool_id         UUID REFERENCES tools(id),
  function_name   TEXT NOT NULL,
  function_arn    TEXT NOT NULL,
  function_url    TEXT,
  status          TEXT CHECK (status IN ('CREATING', 'ACTIVE', 'FAILED', 'DELETED')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_invoked_at TIMESTAMPTZ,
  UNIQUE (user_id, tool_id)
);
```

---

#### Ticket 3.6: Create Lambda Client Wrapper

**Files to create:**
- `orchestrator/src/discovery/provisioning/lambdaClient.ts`

**Purpose:** Wrap AWS Lambda SDK with error handling and retry logic

---

### Phase 4: Tool Packaging & Management

#### Ticket 4.1: Create Tool Packaging Library

**Files to create:**
```
orchestrator/src/tools/packaging/
├── index.ts
├── npm.ts
└── s3.ts
```

**Main function:**
```typescript
export async function packageTool(
  name: string,
  npmPackage: string,
  version: string = 'latest'
): Promise<{ s3Key: string; size: number }> {
  // 1. npm install in Docker container
  // 2. zip with symlink preservation
  // 3. Upload to S3
  // 4. Return S3 key
}
```

---

#### Ticket 4.2: Create Tool Package CLI

**Files to create:**
- `orchestrator/scripts/package-mcp-tool.ts`

**Usage:**
```bash
npx ts-node scripts/package-mcp-tool.ts \
  --name context7 \
  --package @upstash/context7-mcp \
  --version latest
```

---

#### Ticket 4.3: Add S3 Package Verification

**Files to create:**
- `orchestrator/src/tools/packaging/verify.ts`

---

#### Ticket 4.4: Create Tool Registry Sync

**Files to create:**
- `orchestrator/src/tools/registry/sync.ts`

---

### Phase 5: End-to-End Testing

#### Ticket 5.1: Create Lambda Test Infrastructure

**Files to create:**
```
orchestrator/tests/lambda/
├── setup.ts
├── teardown.ts
└── fixtures/mock-tool/
    ├── package.json
    └── index.js
```

---

#### Ticket 5.2: Unit Tests - Lambda Transport (Go)

**Files to create:**
- `internal/service/mcp/lambda_test.go`

**Tests:**
| Test | Description |
|------|-------------|
| `TestLambdaConfigParsing` | Config struct parsing |
| `TestLambdaURLConstruction` | URL building with query params |
| `TestSSEResponseParsing` | Parse SSE data frames |
| `TestLambdaErrorHandling` | Timeout, 5xx errors |
| `TestLambdaColdStartDetection` | Detect cold start delays |

---

#### Ticket 5.3: Unit Tests - Lambda Provisioner (TypeScript)

**Files to create:**
- `orchestrator/tests/lambda/provisioner.spec.ts`

**Tests:**
| Test | Description |
|------|-------------|
| `should provision Lambda function for user` | Happy path |
| `should return existing Lambda URL` | Caching |
| `should handle provision failure` | Error handling |
| `should stop/delete Lambda function` | Cleanup |
| `should check Lambda health correctly` | Health check |

---

#### Ticket 5.4: Unit Tests - Tool Packaging

**Files to create:**
- `orchestrator/tests/lambda/packaging.spec.ts`

---

#### Ticket 5.5: Integration Tests - Lambda Tool Call Flow

**Files to create:**
- `orchestrator/tests/lambda/integration/tool_call.spec.ts`

---

#### Ticket 5.6: Integration Tests - Discovery to Lambda Flow

**Files to create:**
- `orchestrator/tests/lambda/integration/discovery_lambda.spec.ts`

---

#### Ticket 5.7: E2E Tests - Full Pipeline

**Files to create:**
```
orchestrator/tests/lambda/e2e/
├── full_pipeline.spec.ts
└── test_client.ts
```

**Tests:**
| Test | Description |
|------|-------------|
| `e2e: register Lambda tool and call it` | Basic flow |
| `e2e: discover missing tool, provision, retry` | Discovery flow |
| `e2e: per-user Lambda isolation` | Multi-tenant |
| `e2e: tool caching on warm Lambda` | Performance |
| `e2e: concurrent Lambda invocations` | Concurrency |

---

#### Ticket 5.8: Performance & Load Tests

**Files to create:**
```
orchestrator/tests/lambda/performance/
├── cold_start.spec.ts
└── throughput.spec.ts
```

---

### Phase 6: Documentation

#### Ticket 6.1: Update Architecture Documentation

**Files to modify:**
- `docs/ARCHITECTURE.md`

**Sections to update:**
- Add Lambda transport to system diagram
- Document Lambda flow in Section 11
- Add Lambda to transport type table
- Update integration points section

---

#### Ticket 6.2: Create Lambda Setup Guide

**Files to create:**
- `docs/guides/LAMBDA_SETUP.md`

**Sections:**
1. Prerequisites (AWS account, IAM permissions)
2. Infrastructure deployment with Terraform
3. Environment variable configuration
4. Verifying deployment
5. Troubleshooting common issues

---

#### Ticket 6.3: Create Lambda Tool Packaging Guide

**Files to create:**
- `docs/guides/LAMBDA_TOOL_PACKAGING.md`

---

#### Ticket 6.4: Create Lambda API Reference

**Files to create:**
- `docs/reference/LAMBDA_API.md`

---

#### Ticket 6.5: Update README with Lambda Support

**Files to modify:**
- `README.md`
- `orchestrator/README.md`

---

#### Ticket 6.6: Create Lambda Runbook

**Files to create:**
- `orchestrator/runbooks/LAMBDA_OPERATIONS.md`

---

## 5. Dependency Graph

```
Phase 1: Infrastructure Foundation
  ├── 1.1 Create Infrastructure Module ─────────────────┐
  ├── 1.2 Create Docker Image Pipeline ─────────────────┤
  ├── 1.3 Create Deployment Scripts ────────────────────┤
  ├── 1.4 Add AWS SDK Dependencies ─────────────────────┤
  ├── 1.5 Create Env Var Schema ────────────────────────┤
  └── 1.6 Create AWS Config Types ──────────────────────┘
                        │
                        ▼
Phase 2: Go Transport Layer
  ├── 2.1 Add Lambda Transport Type ────────────────────┐
  ├── 2.2 Create Lambda Config Model (depends on 2.1) ──┤
  ├── 2.3 Implement Lambda MCP Client (depends on 2.2) ─┤
  ├── 2.4 Integrate in Session Factory (depends on 2.3) ┤
  └── 2.5 Add Registration Support (depends on 2.4) ────┘
                        │
                        ▼
Phase 3: Orchestrator Provisioning (parallel with Phase 2)
  ├── 3.1 Create Lambda Provisioner (depends on 1.4, 1.6)
  ├── 3.2 Register Lambda Provisioner (depends on 3.1)
  ├── 3.3 Create Lambda Tool Provisioner (depends on 3.1)
  ├── 3.4 Integrate in Tool Installer (depends on 3.3)
  ├── 3.5 Create Supabase Schema
  └── 3.6 Create Lambda Client Wrapper (depends on 1.4)
                        │
                        ▼
Phase 4: Tool Packaging (parallel after Phase 1)
  ├── 4.1 Create Packaging Library (depends on 1.3)
  ├── 4.2 Create Package CLI (depends on 4.1)
  ├── 4.3 Add S3 Verification (depends on 4.1)
  └── 4.4 Create Registry Sync (depends on 4.3, 3.5)
                        │
                        ▼
Phase 5: Testing (depends on Phases 2, 3, 4)
  ├── 5.1 Create Test Infrastructure
  ├── 5.2 Unit Tests - Go Transport (depends on 2.4)
  ├── 5.3 Unit Tests - TS Provisioner (depends on 3.2)
  ├── 5.4 Unit Tests - Packaging (depends on 4.1)
  ├── 5.5 Integration - Tool Call (depends on 5.1-5.4)
  ├── 5.6 Integration - Discovery (depends on 5.5)
  ├── 5.7 E2E - Full Pipeline (depends on 5.5, 5.6)
  └── 5.8 Performance Tests (depends on 5.7)
                        │
                        ▼
Phase 6: Documentation (can start parallel after Phase 3)
  ├── 6.1 Update Architecture.md
  ├── 6.2 Lambda Setup Guide
  ├── 6.3 Tool Packaging Guide
  ├── 6.4 Lambda API Reference
  ├── 6.5 Update READMEs
  └── 6.6 Lambda Runbook
```

---

## 6. Test Matrix

| Test Type | Location | CI Required | AWS Required | Count |
|-----------|----------|-------------|--------------|-------|
| Unit (Go) | `internal/service/mcp/lambda_test.go` | Yes | No (mocked) | 5 |
| Unit (TS) | `tests/lambda/*.spec.ts` | Yes | No (mocked) | 15 |
| Integration | `tests/lambda/integration/*.spec.ts` | Yes | LocalStack | 10 |
| E2E | `tests/lambda/e2e/*.spec.ts` | Nightly | Yes (real AWS) | 5 |
| Performance | `tests/lambda/performance/*.spec.ts` | Weekly | Yes (real AWS) | 4 |
| **Total** | | | | **39** |

---

## 7. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AWS credentials in tests | Medium | High | Use IAM roles, never hardcode, use LocalStack for CI |
| Cold start > 10s | Medium | Medium | Provision SnapStart, optimize package size |
| SSE parsing complexity | Low | Medium | Thorough unit tests, use existing Python client as reference |
| Breaking existing transports | Low | High | Extensive regression tests on existing transports |
| Terraform state conflicts | Medium | Medium | Use S3 backend with locking, document state management |

---

## 8. Acceptance Criteria

### Functional Requirements

- [ ] Lambda transport type works for registered MCP servers
- [ ] Tools can be packaged and uploaded to S3
- [ ] Cold start downloads package and caches in /tmp
- [ ] Warm start uses cached package
- [ ] SSE streaming responses work correctly
- [ ] Discovery → Lambda provision → Retry flow works
- [ ] Per-user Lambda isolation works

### Non-Functional Requirements

- [ ] Cold start completes within 10 seconds
- [ ] Warm invocation completes within 2 seconds
- [ ] All existing tests continue to pass
- [ ] Documentation complete and accurate
- [ ] 39 new tests pass

---

## 9. Estimated Effort

| Phase | Tickets | Estimated Hours | Complexity |
|-------|---------|-----------------|------------|
| Phase 1: Infrastructure | 6 | 16 | Medium |
| Phase 2: Go Transport | 5 | 20 | High |
| Phase 3: Orchestrator Provisioning | 6 | 24 | High |
| Phase 4: Tool Packaging | 4 | 12 | Medium |
| Phase 5: Testing | 8 | 32 | High |
| Phase 6: Documentation | 6 | 12 | Low |
| **Total** | **35** | **116** | |

---

## 10. Files Summary

### New Files to Create (37 total)

```
orchestrator/infrastructure/lambda/
├── README.md
├── main.tf
├── variables.tf
├── outputs.tf
├── Dockerfile
├── src/index.js
├── .dockerignore
└── scripts/
    ├── deploy.sh
    ├── package-tool.sh
    └── destroy.sh

orchestrator/src/
├── config/aws.ts
├── provisioning/lambda.ts
├── discovery/provisioning/
│   ├── lambdaTool.ts
│   └── lambdaClient.ts
└── tools/packaging/
    ├── index.ts
    ├── npm.ts
    ├── s3.ts
    └── verify.ts

orchestrator/scripts/
└── package-mcp-tool.ts

internal/
├── model/lambda_config.go
└── service/mcp/lambda.go

orchestrator/tests/lambda/
├── setup.ts
├── teardown.ts
├── provisioner.spec.ts
├── packaging.spec.ts
├── fixtures/mock-tool/
├── integration/
│   ├── tool_call.spec.ts
│   └── discovery_lambda.spec.ts
├── e2e/
│   ├── full_pipeline.spec.ts
│   └── test_client.ts
└── performance/
    ├── cold_start.spec.ts
    └── throughput.spec.ts

docs/
├── guides/
│   ├── LAMBDA_SETUP.md
│   └── LAMBDA_TOOL_PACKAGING.md
└── reference/LAMBDA_API.md

orchestrator/runbooks/
└── LAMBDA_OPERATIONS.md

migrations/
└── xxx_add_lambda_tables.sql

internal/service/mcp/
└── lambda_test.go
```

### Files to Modify (12 total)

```
pkg/types/mcp_server.go
internal/model/mcp_server.go
internal/service/mcp/util.go
internal/api/mcp_servers.go
cmd/register.go
orchestrator/src/config/schema.ts
orchestrator/src/provisioning/types.ts
orchestrator/src/discovery/provisioning/installer.ts
orchestrator/package.json
docs/ARCHITECTURE.md
README.md
orchestrator/README.md
```

---

## Appendix: Reference Code

### A. Original dynamic_adapter.js (Clean Dynamic Start)

Location: `../Clean Dynamic Start/src/dynamic_adapter.js`

Key features:
- S3 package download
- Native unzip for symlink preservation
- SSE streaming with `lambda-stream`
- Process spawning with stdin/stdout piping
- Timeout handling (30s for POST, 14min for GET)

### B. Original test_client.py

Location: `../Clean Dynamic Start/test_client.py`

Use as reference for E2E test client implementation.

---

*Document Version: 1.0*  
*Last Updated: January 12, 2026*
