# Lambda Operations Runbook

> Operational procedures for managing MCPJungle Lambda infrastructure.

---

## Current Deployment

| Resource | Value |
|----------|-------|
| **Lambda Function** | `mcpjungle-mcp-launcher` |
| **Lambda URL** | `https://ovltvsbxtg6dznuuvwwtofc7sm0dspdg.lambda-url.us-east-1.on.aws/` |
| **S3 Bucket** | `mcp-tools-20260121000919294600000001` |
| **CloudWatch Logs** | `/aws/lambda/mcpjungle-mcp-launcher` |
| **Region** | `us-east-1` |

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Incident Response](#incident-response)
3. [Scaling Procedures](#scaling-procedures)
4. [Maintenance Windows](#maintenance-windows)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring & Alerting](#monitoring--alerting)

---

## Daily Operations

### Health Check

Run daily health checks:

```bash
# Check Lambda function status
aws lambda get-function --function-name mcpjungle-adapter \
  --query 'Configuration.{State:State,LastModified:LastModified}'

# Check recent invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=mcpjungle-adapter \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Sum

# Check error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=mcpjungle-adapter \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Sum
```

### Log Review

```bash
# View recent logs
aws logs tail /aws/lambda/mcpjungle-adapter --since 1h

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/mcpjungle-adapter \
  --filter-pattern "ERROR" \
  --start-time $(date -v-1H +%s000)

# Search for cold starts
aws logs filter-log-events \
  --log-group-name /aws/lambda/mcpjungle-adapter \
  --filter-pattern "COLD_START" \
  --start-time $(date -v-1H +%s000)
```

### S3 Package Inventory

```bash
# List all packages
aws s3 ls s3://mcpjungle-packages-xxx/packages/ --recursive

# Check package sizes
aws s3 ls s3://mcpjungle-packages-xxx/packages/ --recursive --human-readable
```

---

## Incident Response

### High Error Rate

**Symptoms:** Error rate > 5%

**Diagnosis:**

```bash
# Check error logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/mcpjungle-adapter \
  --filter-pattern "ERROR" \
  --start-time $(date -v-15M +%s000)

# Check if specific tool is failing
aws logs filter-log-events \
  --log-group-name /aws/lambda/mcpjungle-adapter \
  --filter-pattern "tool=" \
  --start-time $(date -v-15M +%s000)
```

**Resolution:**

1. Identify the failing tool from logs
2. Check S3 package exists and is valid
3. Test the tool directly:
   ```bash
   curl "https://LAMBDA_URL?tool=TOOL_NAME" \
     -X POST -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
   ```
4. If package is corrupt, re-upload:
   ```bash
   npx tsx scripts/package-mcp-tool.ts --name TOOL_NAME --package NPM_PACKAGE
   ```

### High Latency

**Symptoms:** p95 latency > 10 seconds

**Diagnosis:**

```bash
# Check duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=mcpjungle-adapter \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics p95

# Check cold start frequency
aws logs filter-log-events \
  --log-group-name /aws/lambda/mcpjungle-adapter \
  --filter-pattern "COLD_START=true" \
  --start-time $(date -v-1H +%s000) | wc -l
```

**Resolution:**

1. If high cold start rate, consider:
   - Provisioned concurrency
   - Smaller package sizes
   - Pre-warming strategy

2. If warm requests are slow:
   - Check tool execution time
   - Increase memory allocation
   - Check network latency to S3

### Lambda Throttling

**Symptoms:** 429 errors, ConcurrentExecutions at limit

**Diagnosis:**

```bash
# Check concurrent executions
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name ConcurrentExecutions \
  --dimensions Name=FunctionName,Value=mcpjungle-adapter \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics Maximum
```

**Resolution:**

```bash
# Request limit increase
aws service-quotas request-service-quota-increase \
  --service-code lambda \
  --quota-code L-B99A9384 \
  --desired-value 3000
```

### S3 Access Denied

**Symptoms:** "Access Denied" errors when downloading packages

**Diagnosis:**

```bash
# Check IAM role
aws lambda get-function --function-name mcpjungle-adapter \
  --query 'Configuration.Role'

# Check role policies
aws iam list-attached-role-policies --role-name mcpjungle-lambda-role
aws iam list-role-policies --role-name mcpjungle-lambda-role
```

**Resolution:**

1. Verify S3 bucket name matches config
2. Check IAM policy includes correct bucket ARN
3. Reattach policy if needed:
   ```bash
   aws iam put-role-policy \
     --role-name mcpjungle-lambda-role \
     --policy-name s3-access \
     --policy-document file://s3-policy.json
   ```

---

## Scaling Procedures

### Increase Capacity

```bash
# Increase reserved concurrency
aws lambda put-function-concurrency \
  --function-name mcpjungle-adapter \
  --reserved-concurrent-executions 500

# Add provisioned concurrency (reduces cold starts)
aws lambda put-provisioned-concurrency-config \
  --function-name mcpjungle-adapter \
  --qualifier \$LATEST \
  --provisioned-concurrent-executions 10
```

### Increase Resources

```bash
# Update memory (also increases CPU)
aws lambda update-function-configuration \
  --function-name mcpjungle-adapter \
  --memory-size 2048

# Update timeout
aws lambda update-function-configuration \
  --function-name mcpjungle-adapter \
  --timeout 60

# Update ephemeral storage
aws lambda update-function-configuration \
  --function-name mcpjungle-adapter \
  --ephemeral-storage '{"Size": 2048}'
```

---

## Maintenance Windows

### Deploying New Adapter Version

1. **Build new image:**
   ```bash
   cd orchestrator/infrastructure/lambda
   docker build -t mcpjungle-adapter:v2.0.0 .
   ```

2. **Push to ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin $ECR_REPO
   docker tag mcpjungle-adapter:v2.0.0 $ECR_REPO:v2.0.0
   docker push $ECR_REPO:v2.0.0
   ```

3. **Update Lambda (with alias for rollback):**
   ```bash
   # Publish new version
   aws lambda update-function-code \
     --function-name mcpjungle-adapter \
     --image-uri $ECR_REPO:v2.0.0

   # Wait for update
   aws lambda wait function-updated --function-name mcpjungle-adapter

   # Publish version
   aws lambda publish-version \
     --function-name mcpjungle-adapter \
     --description "v2.0.0 release"

   # Update alias (for gradual rollout)
   aws lambda update-alias \
     --function-name mcpjungle-adapter \
     --name prod \
     --routing-config '{"AdditionalVersionWeights":{"2":0.1}}'
   ```

### Updating Tool Packages

```bash
# Re-package and upload
npx tsx scripts/package-mcp-tool.ts \
  --name context7 \
  --package @upstash/context7-mcp \
  --version v1.1.0

# Verify upload
aws s3 ls s3://mcpjungle-packages-xxx/packages/context7/

# Test new version
curl "https://LAMBDA_URL?tool=context7&version=v1.1.0" \
  -X POST -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```

---

## Rollback Procedures

### Rollback Lambda Version

```bash
# List versions
aws lambda list-versions-by-function \
  --function-name mcpjungle-adapter

# Rollback alias to previous version
aws lambda update-alias \
  --function-name mcpjungle-adapter \
  --name prod \
  --function-version 5 \
  --routing-config '{}'
```

### Rollback Tool Package

```bash
# List available versions
aws s3 ls s3://mcpjungle-packages-xxx/packages/context7/

# Copy previous version to latest
aws s3 cp \
  s3://mcpjungle-packages-xxx/packages/context7/v1.0.0.zip \
  s3://mcpjungle-packages-xxx/packages/context7/latest.zip
```

---

## Monitoring & Alerting

### CloudWatch Alarms

Create these alarms:

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name mcpjungle-lambda-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --dimensions Name=FunctionName,Value=mcpjungle-adapter \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:alerts

# High latency alarm
aws cloudwatch put-metric-alarm \
  --alarm-name mcpjungle-lambda-latency \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --dimensions Name=FunctionName,Value=mcpjungle-adapter \
  --extended-statistic p95 \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10000 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:alerts

# Throttling alarm
aws cloudwatch put-metric-alarm \
  --alarm-name mcpjungle-lambda-throttles \
  --metric-name Throttles \
  --namespace AWS/Lambda \
  --dimensions Name=FunctionName,Value=mcpjungle-adapter \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:alerts
```

### Dashboard

Create a CloudWatch dashboard with:

- Invocations (Sum)
- Duration (p50, p95, p99)
- Errors (Sum)
- Throttles (Sum)
- ConcurrentExecutions (Max)
- Cold starts (custom metric)

---

## Emergency Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| On-call Engineer | @oncall | First responder |
| Lambda Owner | @lambda-team | Lambda-specific issues |
| AWS Support | AWS Console | Service issues |

---

## Related Documentation

- [Lambda Setup Guide](SETUP.md)
- [Tool Packaging Guide](PACKAGING.md)
- [API Reference](API.md)

---

*Last Updated: January 13, 2026*
