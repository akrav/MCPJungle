# ==============================================================================
# Lambda MCP Adapter - Main Terraform Configuration
# ==============================================================================
# This module deploys the AWS infrastructure for the MCPJungle Lambda adapter:
# - ECR Repository for the adapter Docker image
# - S3 Bucket for MCP tool packages
# - IAM Role with necessary permissions
# - Lambda Function with streaming response support
# - Lambda Function URL for public access
# ==============================================================================

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }
}

# ------------------------------------------------------------------------------
# Provider Configuration
# ------------------------------------------------------------------------------

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(
      {
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "terraform"
      },
      var.tags
    )
  }
}

# ------------------------------------------------------------------------------
# Local Values
# ------------------------------------------------------------------------------

locals {
  # Full resource names with project prefix
  ecr_repo_name    = "${var.project_name}-${var.ecr_repository_name}"
  lambda_func_name = "${var.project_name}-${var.lambda_function_name}"
  iam_role_name    = "${var.project_name}-${var.iam_role_name}"
}

# ------------------------------------------------------------------------------
# ECR Repository
# ------------------------------------------------------------------------------
# Stores the Docker image for the Lambda adapter

resource "aws_ecr_repository" "adapter_repo" {
  name         = local.ecr_repo_name
  force_delete = var.ecr_force_delete

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = local.ecr_repo_name
  }
}

# Lifecycle policy to keep only the last 10 images
resource "aws_ecr_lifecycle_policy" "adapter_repo_policy" {
  repository = aws_ecr_repository.adapter_repo.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# S3 Bucket for Tool Packages
# ------------------------------------------------------------------------------
# Stores the zipped MCP tool packages that Lambda downloads

resource "aws_s3_bucket" "artifacts" {
  bucket_prefix = var.s3_bucket_prefix
  force_destroy = var.s3_force_destroy

  tags = {
    Name = "${var.project_name}-mcp-tools"
  }
}

# Block all public access to the bucket
resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for rollback capability
resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ------------------------------------------------------------------------------
# IAM Role for Lambda
# ------------------------------------------------------------------------------

resource "aws_iam_role" "lambda_exec" {
  name = local.iam_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = local.iam_role_name
  }
}

# Attach basic Lambda execution role (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy for S3 read access
resource "aws_iam_role_policy" "lambda_s3_access" {
  name = "${local.iam_role_name}-s3-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:HeadObject"
        ]
        Resource = "${aws_s3_bucket.artifacts.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.artifacts.arn
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# Lambda Function
# ------------------------------------------------------------------------------

resource "aws_lambda_function" "launcher" {
  function_name = local.lambda_func_name
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.adapter_repo.repository_url}:${var.lambda_image_tag}"

  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size

  ephemeral_storage {
    size = var.lambda_ephemeral_storage
  }

  environment {
    variables = {
      ARTIFACT_BUCKET = aws_s3_bucket.artifacts.bucket
      MCP_REGION      = var.aws_region  # Note: AWS_REGION is reserved, use MCP_REGION instead
      ENVIRONMENT     = var.environment
    }
  }

  # Ensure the ECR repository exists before creating the Lambda
  depends_on = [
    aws_ecr_repository.adapter_repo,
    aws_iam_role_policy.lambda_s3_access,
    aws_iam_role_policy_attachment.lambda_logs
  ]

  tags = {
    Name = local.lambda_func_name
  }

  # Ignore changes to image_uri as it's managed by the deploy script
  lifecycle {
    ignore_changes = [image_uri]
  }
}

# ------------------------------------------------------------------------------
# Lambda Function URL
# ------------------------------------------------------------------------------
# Provides a public HTTPS endpoint for the Lambda function

resource "aws_lambda_function_url" "launcher_url" {
  function_name      = aws_lambda_function.launcher.function_name
  authorization_type = var.lambda_url_authorization
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_origins = var.lambda_url_cors_origins
    allow_methods = var.lambda_url_cors_methods
    allow_headers = ["*"]
    max_age       = 86400
  }
}

# ------------------------------------------------------------------------------
# CloudWatch Log Group
# ------------------------------------------------------------------------------
# Explicit log group with retention policy

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${local.lambda_func_name}"
  retention_in_days = 14

  tags = {
    Name = "${local.lambda_func_name}-logs"
  }
}
