#!/bin/bash
# ==============================================================================
# Lambda MCP Adapter - Full Deployment Script
# ==============================================================================
# This script performs a complete deployment of the Lambda MCP adapter:
# 1. Initializes Terraform
# 2. Creates the ECR repository
# 3. Builds and pushes the Docker image
# 4. Deploys all infrastructure
# 5. Updates the Lambda function with the new image
#
# Usage: ./deploy.sh [environment]
#   environment: dev, staging, prod (default: dev)
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TAG="v-$(date +%s)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ------------------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

cleanup_on_error() {
    log_error "Deployment failed! Check the error above."
    exit 1
}

trap cleanup_on_error ERR

# ------------------------------------------------------------------------------
# Pre-flight Checks
# ------------------------------------------------------------------------------

log_info "Starting deployment for environment: $ENVIRONMENT"

# Check required tools
for cmd in aws docker terraform; do
    if ! command -v $cmd &> /dev/null; then
        log_error "$cmd is required but not installed."
        exit 1
    fi
done

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

log_success "Pre-flight checks passed"

# ------------------------------------------------------------------------------
# Step 1: Initialize Terraform
# ------------------------------------------------------------------------------

cd "$PROJECT_DIR"

log_info "Initializing Terraform..."
terraform init -upgrade

# ------------------------------------------------------------------------------
# Step 2: Create ECR Repository First
# ------------------------------------------------------------------------------
# This breaks the chicken/egg dependency - we need the ECR URL to push images

log_info "Creating ECR repository..."
terraform apply -target=aws_ecr_repository.adapter_repo -auto-approve

# Get the ECR repository URL
ECR_REPO_URL=$(terraform output -raw ecr_repository_url)

if [ -z "$ECR_REPO_URL" ]; then
    log_error "Failed to get ECR repository URL"
    exit 1
fi

log_success "ECR repository created: $ECR_REPO_URL"

# ------------------------------------------------------------------------------
# Step 3: Build and Push Docker Image
# ------------------------------------------------------------------------------

log_info "Logging into ECR..."
ECR_DOMAIN=$(echo "$ECR_REPO_URL" | cut -d'/' -f1)
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_DOMAIN"

log_info "Building Docker image (tag: $TAG)..."
docker build \
    --no-cache \
    --platform linux/amd64 \
    -t mcp-adapter:latest \
    -t mcp-adapter:$TAG \
    "$PROJECT_DIR"

log_info "Tagging image for ECR..."
docker tag mcp-adapter:latest "$ECR_REPO_URL:latest"
docker tag mcp-adapter:$TAG "$ECR_REPO_URL:$TAG"

log_info "Pushing image to ECR..."
docker push "$ECR_REPO_URL:latest"
docker push "$ECR_REPO_URL:$TAG"

log_success "Docker image pushed: $ECR_REPO_URL:$TAG"

# ------------------------------------------------------------------------------
# Step 4: Deploy Full Infrastructure
# ------------------------------------------------------------------------------

log_info "Deploying full infrastructure..."
terraform apply \
    -var="environment=$ENVIRONMENT" \
    -var="lambda_image_tag=$TAG" \
    -auto-approve

# ------------------------------------------------------------------------------
# Step 5: Force Lambda Update (ensures new image is used)
# ------------------------------------------------------------------------------

LAMBDA_FUNCTION_NAME=$(terraform output -raw lambda_function_name)

log_info "Updating Lambda function code..."
aws lambda update-function-code \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --image-uri "$ECR_REPO_URL:$TAG" \
    --region "$AWS_REGION" \
    > /dev/null

# Wait for update to complete
log_info "Waiting for Lambda update to complete..."
aws lambda wait function-updated \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION"

log_success "Lambda function updated"

# ------------------------------------------------------------------------------
# Step 6: Output Results
# ------------------------------------------------------------------------------

echo ""
echo "=============================================="
log_success "Deployment Complete!"
echo "=============================================="
echo ""

LAMBDA_URL=$(terraform output -raw lambda_function_url)
S3_BUCKET=$(terraform output -raw artifact_bucket_name)

echo "📦 ECR Repository: $ECR_REPO_URL"
echo "📁 S3 Bucket: $S3_BUCKET"
echo "🌐 Lambda URL: $LAMBDA_URL"
echo ""
echo "To test the deployment, upload a tool package and run:"
echo ""
echo "  curl -X POST \"${LAMBDA_URL}?tool=<name>&version=latest\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\"}}'"
echo ""
