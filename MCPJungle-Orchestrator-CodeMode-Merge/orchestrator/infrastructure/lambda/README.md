# Lambda MCP Adapter Infrastructure

This directory contains Terraform configuration to deploy the AWS infrastructure for the MCPJungle Lambda adapter.

## Overview

The Lambda adapter enables dynamic loading and execution of MCP (Model Context Protocol) tools on AWS Lambda. Tools are stored as zip packages in S3 and loaded on-demand when the Lambda function is invoked.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Lambda Function                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  1. Receive request with ?tool=<name>&version=<ver>       │  │
│  │  2. Check /tmp cache for tool                             │  │
│  │  3. If missing, download from S3 and unzip                │  │
│  │  4. Spawn tool binary, pipe JSON-RPC via stdin/stdout     │  │
│  │  5. Stream SSE response back to caller                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    │
│  │  /tmp cache   │    │  S3 Bucket    │    │  CloudWatch   │    │
│  │  (warm start) │    │  (packages)   │    │  (logs)       │    │
│  └───────────────┘    └───────────────┘    └───────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0.0
3. **Docker** for building the Lambda image

## Quick Start

### 1. Initialize Terraform

```bash
cd orchestrator/infrastructure/lambda
terraform init
```

### 2. Create a `terraform.tfvars` file (optional)

```hcl
aws_region           = "us-east-1"
environment          = "dev"
project_name         = "mcpjungle"
lambda_memory_size   = 2048
lambda_timeout       = 900
```

### 3. Deploy the Infrastructure

```bash
# Use the deploy script for full deployment including Docker image
./scripts/deploy.sh

# Or deploy infrastructure only (requires image to exist)
terraform apply
```

### 4. Upload a Tool Package

```bash
# Package a tool
./scripts/package-tool.sh context7 @upstash/context7-mcp latest

# Upload to S3
aws s3 cp context7-latest.zip s3://$(terraform output -raw artifact_bucket_name)/packages/context7/latest.zip
```

### 5. Test the Endpoint

```bash
# Get the Lambda URL
LAMBDA_URL=$(terraform output -raw lambda_function_url)

# Send a test request
curl -X POST "${LAMBDA_URL}?tool=context7&version=latest" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

## Supported Languages

The Lambda adapter supports multiple programming languages for MCP servers:

| Language | Detection Method | Requirements |
|----------|-----------------|--------------|
| **Python** | `main.py`, `app.py`, `index.py`, or manifest | Python 3.9+ installed in image |
| **Node.js** | `node_modules/.bin/*` or `package.json` + `index.js` | Node.js 20 installed |
| **Binary (Go/Rust/C#)** | `manifest.json` with explicit command | Linux AMD64 binary |

### Runtime Resolution Priority

The adapter resolves which runtime to use in this order:

1. **manifest.json (MCP Bundle Standard)** - If present, uses `server.command` and `server.args`
2. **mcp.json (Custom format)** - Legacy format with `executable` and `args`
3. **Python Heuristic** - Looks for `main.py`, `app.py`, `index.py`, or `__main__.py`
4. **Node.js Heuristic** - Looks for executables in `node_modules/.bin/` or `package.json` + `index.js`

## Manifest Files

### manifest.json (MCP Bundle Standard)

The recommended manifest format following the MCP Bundle specification:

```json
{
  "manifest_version": "0.1",
  "name": "my-tool",
  "version": "1.0.0",
  "server": {
    "type": "python",
    "command": "python3",
    "args": ["main.py", "--verbose"],
    "env": {
      "PYTHONUNBUFFERED": "1"
    }
  }
}
```

### mcp.json (Custom/Legacy)

A simpler custom format for backward compatibility:

```json
{
  "spec": "1.0",
  "runtime": "python",
  "executable": "main.py",
  "args": ["--custom-flag"],
  "env": {
    "PYTHONUNBUFFERED": "1"
  }
}
```

## Supported Package Formats

The adapter supports multiple compression formats:

| Format | Extension | Notes |
|--------|-----------|-------|
| ZIP | `.zip` | Standard, recommended |
| TAR.GZ | `.tar.gz`, `.tgz` | Good for preserving permissions |
| MCP Bundle | `.mcpb` | Treated as ZIP internally |

---

## Configuration Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region for deployment | `us-east-1` |
| `environment` | Environment name (dev/staging/prod) | `dev` |
| `project_name` | Prefix for all resource names | `mcpjungle` |
| `lambda_memory_size` | Lambda memory in MB (128-10240) | `2048` |
| `lambda_timeout` | Lambda timeout in seconds (1-900) | `900` |
| `lambda_ephemeral_storage` | /tmp size in MB (512-10240) | `2048` |
| `lambda_url_authorization` | Auth type (NONE or AWS_IAM) | `NONE` |

See `variables.tf` for the complete list.

## Outputs

| Output | Description |
|--------|-------------|
| `lambda_function_url` | Public HTTPS endpoint for the Lambda |
| `artifact_bucket_name` | S3 bucket name for tool packages |
| `ecr_repository_url` | ECR repository for pushing images |
| `lambda_function_arn` | ARN for programmatic invocation |

## Directory Structure

```
lambda/
├── main.tf           # Main Terraform resources
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── README.md         # This file
├── Dockerfile        # Lambda container image
├── src/
│   └── index.js      # Lambda handler code
└── scripts/
    ├── deploy.sh     # Full deployment script
    ├── package-tool.sh   # Tool packaging script
    └── destroy.sh    # Teardown script
```

## Security Considerations

1. **Lambda URL Authorization**: By default, the Lambda URL is public (`NONE`). For production, consider:
   - Setting `lambda_url_authorization = "AWS_IAM"` 
   - Adding API Gateway with authentication

2. **S3 Bucket**: The bucket blocks all public access. Only the Lambda function can read from it.

3. **IAM Role**: The Lambda role has minimal permissions:
   - CloudWatch Logs (write)
   - S3 bucket (read only)

## Troubleshooting

### Lambda times out on cold start

Increase `lambda_memory_size` - more memory = faster CPU = faster unzip.

### Tool not found in S3

Check the S3 path format: `packages/<tool_name>/<version>.<ext>`

Supported extensions: `.zip`, `.tar.gz`, `.tgz`, `.mcpb`

### Permission denied when running binary

The package script should preserve symlinks. Ensure you're using `zip -ry` when creating packages.

## Clean Up

```bash
# Destroy all resources
./scripts/destroy.sh

# Or manually
terraform destroy
```

---

*Part of the MCPJungle Lambda Integration Sprint*
