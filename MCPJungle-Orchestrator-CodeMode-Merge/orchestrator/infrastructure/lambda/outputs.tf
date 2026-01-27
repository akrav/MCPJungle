# ==============================================================================
# Lambda MCP Adapter - Terraform Outputs
# ==============================================================================
# These outputs expose important values from the deployed infrastructure.
# Use these in CI/CD pipelines, scripts, or the orchestrator configuration.
# ==============================================================================

# ------------------------------------------------------------------------------
# ECR Outputs
# ------------------------------------------------------------------------------

output "ecr_repository_url" {
  description = "URL of the ECR repository for pushing Docker images"
  value       = aws_ecr_repository.adapter_repo.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.adapter_repo.arn
}

output "ecr_repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.adapter_repo.name
}

# ------------------------------------------------------------------------------
# S3 Outputs
# ------------------------------------------------------------------------------

output "artifact_bucket_name" {
  description = "Name of the S3 bucket for MCP tool packages"
  value       = aws_s3_bucket.artifacts.bucket
}

output "artifact_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.artifacts.arn
}

output "artifact_bucket_region" {
  description = "Region of the S3 bucket"
  value       = aws_s3_bucket.artifacts.region
}

# ------------------------------------------------------------------------------
# Lambda Outputs
# ------------------------------------------------------------------------------

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.launcher.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.launcher.arn
}

output "lambda_function_url" {
  description = "Public HTTPS URL for the Lambda function"
  value       = aws_lambda_function_url.launcher_url.function_url
}

output "lambda_invoke_arn" {
  description = "Invoke ARN of the Lambda function (for API Gateway integrations)"
  value       = aws_lambda_function.launcher.invoke_arn
}

# ------------------------------------------------------------------------------
# IAM Outputs
# ------------------------------------------------------------------------------

output "lambda_role_arn" {
  description = "ARN of the IAM role used by the Lambda function"
  value       = aws_iam_role.lambda_exec.arn
}

output "lambda_role_name" {
  description = "Name of the IAM role used by the Lambda function"
  value       = aws_iam_role.lambda_exec.name
}

# ------------------------------------------------------------------------------
# CloudWatch Outputs
# ------------------------------------------------------------------------------

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch Log Group for Lambda logs"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.lambda_logs.arn
}

# ------------------------------------------------------------------------------
# Convenience Outputs
# ------------------------------------------------------------------------------

output "deployment_info" {
  description = "Summary of deployment information for quick reference"
  value = {
    region           = var.aws_region
    environment      = var.environment
    lambda_url       = aws_lambda_function_url.launcher_url.function_url
    s3_bucket        = aws_s3_bucket.artifacts.bucket
    ecr_repo         = aws_ecr_repository.adapter_repo.repository_url
    lambda_memory_mb = var.lambda_memory_size
    lambda_timeout_s = var.lambda_timeout
  }
}

# Example usage output (helpful for operators)
output "example_usage" {
  description = "Example curl command to test the Lambda endpoint"
  value       = <<-EOT
    # Test the Lambda endpoint with the context7 tool:
    curl -X POST "${aws_lambda_function_url.launcher_url.function_url}?tool=context7&version=latest" \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  EOT
}
