#!/bin/bash
# ==============================================================================
# Lambda MCP Adapter - Destroy Script
# ==============================================================================
# This script tears down all Lambda infrastructure.
# 
# WARNING: This will delete all resources including:
# - Lambda function
# - ECR repository (including all images)
# - S3 bucket (including all objects)
# - IAM roles and policies
# - CloudWatch log group
#
# Usage: ./destroy.sh [--force]
#   --force: Skip confirmation prompt
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ------------------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------------------

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# ------------------------------------------------------------------------------
# Parse Arguments
# ------------------------------------------------------------------------------

FORCE=false
for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE=true
    fi
done

# ------------------------------------------------------------------------------
# Confirmation
# ------------------------------------------------------------------------------

if [ "$FORCE" = false ]; then
    echo ""
    log_warn "This will DESTROY all Lambda MCP Adapter infrastructure!"
    echo ""
    echo "The following resources will be deleted:"
    echo "  - Lambda function"
    echo "  - ECR repository (and all images)"
    echo "  - S3 bucket (and all objects)"
    echo "  - IAM roles and policies"
    echo "  - CloudWatch log group"
    echo ""
    
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Aborted."
        exit 0
    fi
fi

# ------------------------------------------------------------------------------
# Pre-flight Checks
# ------------------------------------------------------------------------------

cd "$PROJECT_DIR"

if [ ! -f "terraform.tfstate" ] && [ ! -d ".terraform" ]; then
    log_error "No Terraform state found. Nothing to destroy."
    exit 1
fi

# ------------------------------------------------------------------------------
# Step 1: Empty S3 Bucket (if it has objects)
# ------------------------------------------------------------------------------

log_info "Checking S3 bucket..."

if terraform output artifact_bucket_name &> /dev/null; then
    S3_BUCKET=$(terraform output -raw artifact_bucket_name 2>/dev/null || echo "")
    
    if [ -n "$S3_BUCKET" ]; then
        log_info "Emptying S3 bucket: $S3_BUCKET"
        
        # Delete all objects (including versions if versioning is enabled)
        aws s3 rm "s3://$S3_BUCKET" --recursive 2>/dev/null || true
        
        # Delete all object versions
        aws s3api delete-objects \
            --bucket "$S3_BUCKET" \
            --delete "$(aws s3api list-object-versions \
                --bucket "$S3_BUCKET" \
                --output=json \
                --query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}')" \
            2>/dev/null || true
        
        # Delete all delete markers
        aws s3api delete-objects \
            --bucket "$S3_BUCKET" \
            --delete "$(aws s3api list-object-versions \
                --bucket "$S3_BUCKET" \
                --output=json \
                --query='{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}')" \
            2>/dev/null || true
        
        log_success "S3 bucket emptied"
    fi
fi

# ------------------------------------------------------------------------------
# Step 2: Delete ECR Images (if repository exists)
# ------------------------------------------------------------------------------

log_info "Checking ECR repository..."

if terraform output ecr_repository_name &> /dev/null; then
    ECR_REPO=$(terraform output -raw ecr_repository_name 2>/dev/null || echo "")
    
    if [ -n "$ECR_REPO" ]; then
        log_info "Deleting images from ECR: $ECR_REPO"
        
        # Get all image digests and delete them
        aws ecr batch-delete-image \
            --repository-name "$ECR_REPO" \
            --image-ids "$(aws ecr list-images \
                --repository-name "$ECR_REPO" \
                --query 'imageIds[*]' \
                --output json)" \
            2>/dev/null || true
        
        log_success "ECR images deleted"
    fi
fi

# ------------------------------------------------------------------------------
# Step 3: Terraform Destroy
# ------------------------------------------------------------------------------

log_info "Running terraform destroy..."

terraform destroy -auto-approve

# ------------------------------------------------------------------------------
# Step 4: Clean Up Local Files
# ------------------------------------------------------------------------------

log_info "Cleaning up local files..."

# Remove Terraform state files
rm -f terraform.tfstate
rm -f terraform.tfstate.backup
rm -rf .terraform
rm -f .terraform.lock.hcl

# Remove build artifacts
rm -rf builds/

log_success "Local files cleaned up"

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

echo ""
echo "=============================================="
log_success "Infrastructure Destroyed!"
echo "=============================================="
echo ""
echo "All Lambda MCP Adapter resources have been deleted."
echo ""
echo "To redeploy, run:"
echo "  ./scripts/deploy.sh"
echo ""
