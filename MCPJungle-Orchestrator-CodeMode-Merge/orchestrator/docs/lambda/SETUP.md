# Lambda Setup Guide

> Complete guide to deploying MCPJungle Lambda infrastructure on AWS.

---

## Current Deployment

The Lambda infrastructure is already deployed:

| Resource | Value |
|----------|-------|
| **Lambda Function URL** | `https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/` |
| **Lambda Function Name** | `mcpjungle-mcp-launcher` |
| **Lambda ARN** | `arn:aws:lambda:us-east-1:729387880063:function:mcpjungle-mcp-launcher` |
| **S3 Bucket** | `mcp-tools-20260121000919294600000001` |
| **ECR Repository** | `729387880063.dkr.ecr.us-east-1.amazonaws.com/mcpjungle-mcp-dynamic-adapter` |
| **IAM Role** | `mcpjungle-mcp_dynamic_role` |
| **CloudWatch Logs** | `/aws/lambda/mcpjungle-mcp-launcher` |
| **Region** | `us-east-1` |
| **Memory** | 2048 MB |
| **Timeout** | 900 seconds |
| **Ephemeral Storage** | 2048 MB |

### Deployed Tools

| Tool | S3 Path | Status |
|------|---------|--------|
| context7 | `packages/context7/latest.zip` | ✅ Available |

---

## Prerequisites

Before you begin, ensure you have:

- [x] **AWS Account** with appropriate permissions
- [x] **AWS CLI** installed and configured (`aws configure`)
- [x] **Terraform** v1.0+ installed
- [x] **Docker** installed and running
- [x] **Node.js** v20+ installed

---

## Quick Start

### 1. Configure Environment

Create a `.env` file in the project root:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Lambda Configuration
AWS_LAMBDA_FUNCTION_URL=  # Will be set after deployment
AWS_LAMBDA_S3_BUCKET=     # Will be created by Terraform
AWS_LAMBDA_ROLE_ARN=      # Will be created by Terraform
AWS_LAMBDA_ECR_REPO=      # Will be created by Terraform

# Optional
LAMBDA_MEMORY_MB=1024
LAMBDA_TIMEOUT_MS=30000
```

### 2. Deploy Infrastructure

```bash
cd orchestrator/infrastructure/lambda

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Deploy
terraform apply -auto-approve
```

### 3. Build and Push Docker Image

```bash
# Run the deployment script
./scripts/deploy.sh
```

This script will:
1. Build the Lambda adapter Docker image
2. Push it to ECR
3. Update the Lambda function

### 4. Verify Deployment

```bash
# Get the Lambda Function URL from Terraform outputs
terraform output lambda_function_url

# Test the endpoint
curl "$(terraform output -raw lambda_function_url)?tool=echo" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```

---

## Detailed Configuration

### Terraform Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `us-east-1` | AWS region for deployment |
| `ecr_repo_name` | `mcpjungle-adapter` | ECR repository name |
| `s3_bucket_prefix` | `mcpjungle-packages` | S3 bucket prefix |
| `lambda_function_name` | `mcpjungle-adapter` | Lambda function name |
| `lambda_role_name` | `mcpjungle-lambda-role` | IAM role name |
| `lambda_memory_size` | `1024` | Lambda memory in MB |
| `lambda_timeout` | `30` | Lambda timeout in seconds |
| `lambda_ephemeral_storage_size` | `1024` | /tmp storage in MB |
| `lambda_image_tag` | `latest` | Docker image tag |

### Custom Variable File

Create `terraform.tfvars` for custom values:

```hcl
aws_region = "eu-west-1"
lambda_memory_size = 2048
lambda_timeout = 60
lambda_ephemeral_storage_size = 2048
```

---

## IAM Permissions

The Lambda function requires these IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::mcpjungle-packages-*/*"
    }
  ]
}
```

---

## Architecture Details

### Lambda Adapter

The Lambda adapter (`src/index.js`) handles:

1. **Request parsing** - Extracts tool name and version from query params
2. **Package caching** - Downloads from S3 on cold start, caches in `/tmp`
3. **Process spawning** - Runs the MCP tool as a child process
4. **SSE streaming** - Streams responses back using AWS Lambda streaming

### Cold Start Behavior

On cold start:
1. Lambda downloads the tool package from S3
2. Unzips to `/tmp/{tool_name}/`
3. Locates the binary in `node_modules/.bin/`
4. Spawns the process and forwards requests

Warm invocations reuse the cached package in `/tmp`.

### Package Format

Tool packages in S3 must be:
- ZIP files containing `node_modules/` and `package.json`
- Located at `packages/{tool_name}/{version}.zip`
- Include the MCP binary in `node_modules/.bin/`

---

## Monitoring

### CloudWatch Logs

Lambda logs are automatically sent to CloudWatch:

```bash
# View logs
aws logs tail /aws/lambda/mcpjungle-adapter --follow
```

### Key Metrics

Monitor these CloudWatch metrics:
- `Invocations` - Total requests
- `Duration` - Execution time (watch for cold starts)
- `Errors` - Failed invocations
- `ConcurrentExecutions` - Active instances

---

## Troubleshooting

### Common Issues

**Error: "Package not found in S3"**
```
Ensure the tool package exists at s3://{bucket}/packages/{tool}/{version}.zip
```

**Error: "Binary not found"**
```
Check that the package includes node_modules/.bin/{tool-name}
The adapter tries multiple binary name patterns.
```

**Error: "Timeout"**
```
Increase lambda_timeout in terraform.tfvars
Cold starts with large packages may need 30-60 seconds.
```

**Error: "Out of memory"**
```
Increase lambda_memory_size in terraform.tfvars
Some tools require 2048MB+ for complex operations.
```

### Debug Mode

Enable verbose logging:

```bash
# Set in Lambda environment variables
DEBUG=true
```

---

## Cleanup

To destroy all Lambda infrastructure:

```bash
cd orchestrator/infrastructure/lambda
./scripts/destroy.sh

# Or manually
terraform destroy -auto-approve
```

This will remove:
- ECR repository (and all images)
- S3 bucket (and all packages)
- Lambda function
- IAM role
- CloudWatch log group

---

## Next Steps

1. [Package MCP Tools](PACKAGING.md) - How to package tools for Lambda
2. [API Reference](API.md) - Lambda endpoint documentation
3. [Runbook](RUNBOOK.md) - Operations and incident response

---

*Last Updated: January 13, 2026*
