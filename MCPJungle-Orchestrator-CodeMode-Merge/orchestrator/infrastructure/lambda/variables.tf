# ==============================================================================
# Lambda MCP Adapter - Terraform Variables
# ==============================================================================
# These variables allow customization of the Lambda infrastructure deployment.
# Override these by creating a terraform.tfvars file or passing -var flags.
# ==============================================================================

# ------------------------------------------------------------------------------
# AWS Configuration
# ------------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy the Lambda infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "mcpjungle"
}

# ------------------------------------------------------------------------------
# ECR Configuration
# ------------------------------------------------------------------------------

variable "ecr_repository_name" {
  description = "Name of the ECR repository for the Lambda adapter image"
  type        = string
  default     = "mcp-dynamic-adapter"
}

variable "ecr_force_delete" {
  description = "Allow ECR repository to be deleted even if it contains images"
  type        = bool
  default     = true
}

# ------------------------------------------------------------------------------
# S3 Configuration
# ------------------------------------------------------------------------------

variable "s3_bucket_prefix" {
  description = "Prefix for the S3 bucket name (will have random suffix added)"
  type        = string
  default     = "mcp-tools-"
}

variable "s3_force_destroy" {
  description = "Allow S3 bucket to be deleted even if it contains objects"
  type        = bool
  default     = true
}

# ------------------------------------------------------------------------------
# Lambda Configuration
# ------------------------------------------------------------------------------

variable "lambda_function_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "mcp-launcher"
}

variable "lambda_memory_size" {
  description = "Amount of memory (MB) allocated to the Lambda function"
  type        = number
  default     = 2048

  validation {
    condition     = var.lambda_memory_size >= 128 && var.lambda_memory_size <= 10240
    error_message = "Lambda memory size must be between 128 MB and 10240 MB."
  }
}

variable "lambda_timeout" {
  description = "Maximum execution time (seconds) for the Lambda function"
  type        = number
  default     = 900

  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}

variable "lambda_ephemeral_storage" {
  description = "Size (MB) of the /tmp directory for the Lambda function"
  type        = number
  default     = 2048

  validation {
    condition     = var.lambda_ephemeral_storage >= 512 && var.lambda_ephemeral_storage <= 10240
    error_message = "Lambda ephemeral storage must be between 512 MB and 10240 MB."
  }
}

variable "lambda_image_tag" {
  description = "Docker image tag for the Lambda function"
  type        = string
  default     = "latest"
}

# ------------------------------------------------------------------------------
# Lambda URL Configuration
# ------------------------------------------------------------------------------

variable "lambda_url_authorization" {
  description = "Authorization type for Lambda function URL (NONE or AWS_IAM)"
  type        = string
  default     = "NONE"

  validation {
    condition     = contains(["NONE", "AWS_IAM"], var.lambda_url_authorization)
    error_message = "Lambda URL authorization must be either 'NONE' or 'AWS_IAM'."
  }
}

variable "lambda_url_cors_origins" {
  description = "Allowed origins for CORS on Lambda function URL"
  type        = list(string)
  default     = ["*"]
}

variable "lambda_url_cors_methods" {
  description = "Allowed HTTP methods for CORS on Lambda function URL"
  type        = list(string)
  default     = ["GET", "POST"]
}

# ------------------------------------------------------------------------------
# IAM Configuration
# ------------------------------------------------------------------------------

variable "iam_role_name" {
  description = "Name of the IAM role for the Lambda function"
  type        = string
  default     = "mcp_dynamic_role"
}

# ------------------------------------------------------------------------------
# Tags
# ------------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
