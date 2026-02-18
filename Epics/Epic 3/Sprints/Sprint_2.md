# Sprint 2: AWS Deployment & Infrastructure

**Goal:** Deploy the updated Lambda adapter to AWS.
**Estimated Time:** 1 Hour 30 Minutes (6 x 15-min tasks)
**Status:** ✅ COMPLETED (February 15, 2026)
**Dependencies:** Sprint 1 Complete

---

## Pre-requisites
- AWS CLI configured (`aws sts get-caller-identity`)
- Terraform installed (`terraform --version`)
- Sprint 1 completed (Docker image builds locally)

---

## TICKET-201: Initialize Terraform [~15 min]

### Objective
Initialize Terraform and verify the configuration is valid.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Initialize Terraform
terraform init -upgrade

# Validate configuration
terraform validate

# Check what will be created
terraform plan
```

### Expected Output
- `Terraform has been successfully initialized!`
- `Success! The configuration is valid.`
- Plan shows ECR, S3, Lambda, IAM resources

### Verification Checklist
- [x] Terraform initialized successfully
- [x] Configuration is valid
- [x] Plan shows no changes (infrastructure already exists)

---

## TICKET-202: Create ECR Repository [~15 min]

### Objective
Create the ECR repository to store our Docker image.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Create only the ECR repository first
terraform apply -target=aws_ecr_repository.adapter_repo -auto-approve

# Get the ECR URL
ECR_URL=$(terraform output -raw ecr_repository_url)
echo "ECR URL: $ECR_URL"

# Verify it exists in AWS
aws ecr describe-repositories --repository-names $(echo $ECR_URL | cut -d'/' -f2) --region us-east-1
```

### Expected Output
- ECR repository created
- URL format: `123456789.dkr.ecr.us-east-1.amazonaws.com/mcpjungle-...`

### Verification Checklist
- [x] ECR repository exists
- [x] Repository URL: 729387880063.dkr.ecr.us-east-1.amazonaws.com/mcpjungle-mcp-dynamic-adapter
- [x] Repository visible in AWS Console

---

## TICKET-203: Push Docker Image to ECR [~15 min]

### Objective
Authenticate with ECR and push the Docker image.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get ECR URL
ECR_URL=$(terraform output -raw ecr_repository_url)
ECR_DOMAIN=$(echo "$ECR_URL" | cut -d'/' -f1)

# Authenticate Docker with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "$ECR_DOMAIN"

# Tag the local image
docker tag mcp-adapter:local "$ECR_URL:latest"

# Push to ECR
docker push "$ECR_URL:latest"

# Verify the image exists
aws ecr describe-images --repository-name $(echo $ECR_URL | cut -d'/' -f2) --region us-east-1
```

### Expected Output
- `Login Succeeded`
- Push shows layer uploads completing
- `latest: digest: sha256:...`

### Verification Checklist
- [x] Docker authenticated with ECR
- [x] Image pushed successfully (sha256:71047ea09e9acb6f57c3ea89ac66985a2382b931f9002e90f9c6f3f9cbae5f94)
- [x] Image visible in ECR console

---

## TICKET-204: Deploy Full Infrastructure [~15 min]

### Objective
Deploy all remaining infrastructure (S3, Lambda, IAM).

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Deploy everything
terraform apply -auto-approve

# Get outputs
terraform output

# Save key values
LAMBDA_URL=$(terraform output -raw lambda_function_url)
S3_BUCKET=$(terraform output -raw artifact_bucket_name)
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

echo "Lambda URL: $LAMBDA_URL"
echo "S3 Bucket: $S3_BUCKET"
echo "Lambda Name: $LAMBDA_NAME"
```

### Expected Output
- `Apply complete! Resources: X added`
- Lambda URL, S3 bucket, and function name displayed

### Verification Checklist
- [x] Terraform apply - no changes needed (already deployed)
- [x] Lambda function exists: mcpjungle-mcp-launcher
- [x] S3 bucket exists: mcp-tools-20260121000919294600000001
- [x] All outputs captured

---

## TICKET-205: Update Lambda Function Code [~15 min]

### Objective
Force Lambda to use the new Docker image.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get values
LAMBDA_NAME=$(terraform output -raw lambda_function_name)
ECR_URL=$(terraform output -raw ecr_repository_url)

# Update Lambda to use new image
aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --image-uri "$ECR_URL:latest" \
    --region us-east-1

# Wait for update
aws lambda wait function-updated --function-name "$LAMBDA_NAME" --region us-east-1

# Verify status
aws lambda get-function --function-name "$LAMBDA_NAME" --query 'Configuration.{State:State,LastUpdateStatus:LastUpdateStatus}'
```

### Expected Output
```json
{
    "State": "Active",
    "LastUpdateStatus": "Successful"
}
```

### Verification Checklist
- [x] Lambda already using latest image
- [x] CodeSha256 matches ECR digest
- [x] State is "Active"
- [x] LastUpdateStatus is "Successful"

---

## TICKET-206: Verify Lambda Health [~15 min]

### Objective
Make a basic request to verify Lambda is responding.

### Commands
```bash
cd /Users/adam/Documents/GitHub/MCPJungle/MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda

# Get Lambda URL
LAMBDA_URL=$(terraform output -raw lambda_function_url)

# Test with missing tool parameter (should return 400)
curl -s "${LAMBDA_URL}" | jq .

# Check CloudWatch logs for recent activity
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/mcpjungle" --region us-east-1

# Get latest log stream
LOG_GROUP="/aws/lambda/$(terraform output -raw lambda_function_name)"
aws logs describe-log-streams \
    --log-group-name "$LOG_GROUP" \
    --order-by LastEventTime \
    --descending \
    --limit 1 \
    --region us-east-1
```

### Expected Output (missing tool)
```json
{
  "error": "Missing 'tool' query parameter"
}
```

### Verification Checklist
- [x] Lambda responds to requests
- [x] Returns 400 for missing parameters: `{"error":"Missing 'tool' query parameter"}`
- [x] CloudWatch log group exists with recent activity

---

## Sprint 2 Completion Checklist

| Ticket | Description | Time | Status |
|--------|-------------|------|--------|
| TICKET-201 | Initialize Terraform | 15 min | [x] PASSED |
| TICKET-202 | Create ECR Repository | 15 min | [x] PASSED (already exists) |
| TICKET-203 | Push Docker Image | 15 min | [x] PASSED |
| TICKET-204 | Deploy Infrastructure | 15 min | [x] PASSED (already deployed) |
| TICKET-205 | Update Lambda Code | 15 min | [x] PASSED (already current) |
| TICKET-206 | Verify Lambda Health | 15 min | [x] PASSED |

**Sprint Complete:** [x] Completed February 15, 2026
