#!/bin/bash
# ==============================================================================
# Lambda MCP Adapter - Tool Packaging Script
# ==============================================================================
# This script creates a deployable package for an MCP tool:
# 1. Runs npm install in a Docker container matching Lambda environment
# 2. Creates a zip file preserving symlinks (critical for npm binaries)
# 3. Optionally uploads to S3
#
# Usage: ./package-tool.sh <tool-name> <npm-package> [version] [--upload]
#
# Examples:
#   ./package-tool.sh context7 @upstash/context7-mcp
#   ./package-tool.sh weather weather-mcp latest --upload
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_BASE_DIR="$PROJECT_DIR/builds"

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

show_usage() {
    echo "Usage: $0 <tool-name> <npm-package> [version] [--upload]"
    echo ""
    echo "Arguments:"
    echo "  tool-name     Name to identify the tool (e.g., context7)"
    echo "  npm-package   NPM package name (e.g., @upstash/context7-mcp)"
    echo "  version       Package version (default: latest)"
    echo "  --upload      Upload to S3 after packaging"
    echo ""
    echo "Examples:"
    echo "  $0 context7 @upstash/context7-mcp"
    echo "  $0 weather weather-mcp 1.0.0 --upload"
}

cleanup_on_error() {
    log_error "Packaging failed!"
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
    fi
    exit 1
}

trap cleanup_on_error ERR

# ------------------------------------------------------------------------------
# Parse Arguments
# ------------------------------------------------------------------------------

if [ $# -lt 2 ]; then
    log_error "Missing required arguments"
    show_usage
    exit 1
fi

TOOL_NAME="$1"
PACKAGE_NAME="$2"
VERSION="${3:-latest}"
UPLOAD=false

# Check for --upload flag
for arg in "$@"; do
    if [ "$arg" = "--upload" ]; then
        UPLOAD=true
    fi
done

# Remove --upload from version if accidentally passed there
if [ "$VERSION" = "--upload" ]; then
    VERSION="latest"
fi

BUILD_DIR="$BUILD_BASE_DIR/$TOOL_NAME/$VERSION"
ZIP_FILE="$BUILD_BASE_DIR/$TOOL_NAME-$VERSION.zip"

log_info "Packaging tool: $TOOL_NAME"
log_info "NPM package: $PACKAGE_NAME"
log_info "Version: $VERSION"

# ------------------------------------------------------------------------------
# Pre-flight Checks
# ------------------------------------------------------------------------------

if ! command -v docker &> /dev/null; then
    log_error "Docker is required but not installed."
    exit 1
fi

# Verify Docker is running
if ! docker info &> /dev/null; then
    log_error "Docker daemon is not running."
    exit 1
fi

log_success "Pre-flight checks passed"

# ------------------------------------------------------------------------------
# Step 1: Prepare Build Directory
# ------------------------------------------------------------------------------

log_info "Preparing build directory..."

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

ABS_BUILD_DIR=$(cd "$BUILD_DIR" && pwd)

# ------------------------------------------------------------------------------
# Step 2: Build in Docker Container
# ------------------------------------------------------------------------------

log_info "Building $TOOL_NAME in Docker (linux/amd64)..."

# Use the same Node.js version as Lambda
docker run --rm \
    --platform linux/amd64 \
    -v "$ABS_BUILD_DIR":/var/task \
    --entrypoint /bin/sh \
    public.ecr.aws/lambda/nodejs:20 \
    -c "
        cd /var/task && \
        npm init -y > /dev/null 2>&1 && \
        npm install $PACKAGE_NAME --omit=dev && \
        echo 'Build complete'
    "

# ------------------------------------------------------------------------------
# Step 3: Verify Build
# ------------------------------------------------------------------------------

if [ ! -d "$BUILD_DIR/node_modules" ]; then
    log_error "Build failed: node_modules directory not found"
    exit 1
fi

# Check for .bin directory (contains executables)
if [ ! -d "$BUILD_DIR/node_modules/.bin" ]; then
    log_warn "No .bin directory found - package may not have executable binaries"
fi

# List binaries for verification
if [ -d "$BUILD_DIR/node_modules/.bin" ]; then
    log_info "Available binaries:"
    ls -la "$BUILD_DIR/node_modules/.bin" | head -10
fi

log_success "Build verified"

# ------------------------------------------------------------------------------
# Step 4: Create Zip Package
# ------------------------------------------------------------------------------

log_info "Creating zip package..."

cd "$BUILD_DIR"

# IMPORTANT: Use -y flag to store symlinks as symlinks
# This is critical for npm .bin binaries to work correctly
zip -ryq "$ZIP_FILE" .

cd "$PROJECT_DIR"

# Get file size
ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
log_success "Package created: $ZIP_FILE ($ZIP_SIZE)"

# ------------------------------------------------------------------------------
# Step 5: Upload to S3 (if --upload flag)
# ------------------------------------------------------------------------------

if [ "$UPLOAD" = true ]; then
    log_info "Uploading to S3..."
    
    # Get bucket name from Terraform output
    cd "$PROJECT_DIR"
    
    if ! terraform output artifact_bucket_name &> /dev/null; then
        log_error "Could not get S3 bucket name. Run deploy.sh first."
        exit 1
    fi
    
    S3_BUCKET=$(terraform output -raw artifact_bucket_name)
    S3_KEY="packages/$TOOL_NAME/$VERSION.zip"
    
    aws s3 cp "$ZIP_FILE" "s3://$S3_BUCKET/$S3_KEY"
    
    log_success "Uploaded to: s3://$S3_BUCKET/$S3_KEY"
fi

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

echo ""
echo "=============================================="
log_success "Packaging Complete!"
echo "=============================================="
echo ""
echo "📦 Package: $ZIP_FILE"
echo "📏 Size: $ZIP_SIZE"
echo ""

if [ "$UPLOAD" = false ]; then
    echo "To upload to S3, run:"
    echo ""
    echo "  S3_BUCKET=\$(cd $PROJECT_DIR && terraform output -raw artifact_bucket_name)"
    echo "  aws s3 cp $ZIP_FILE s3://\$S3_BUCKET/packages/$TOOL_NAME/$VERSION.zip"
    echo ""
fi

echo "To test locally:"
echo ""
echo "  cd $BUILD_DIR"
echo "  ./node_modules/.bin/${TOOL_NAME}-mcp"
echo ""
