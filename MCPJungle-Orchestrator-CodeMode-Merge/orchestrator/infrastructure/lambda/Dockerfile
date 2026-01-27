# ==============================================================================
# Lambda MCP Adapter - Docker Image
# ==============================================================================
# This image runs on AWS Lambda and dynamically loads MCP tools from S3.
# 
# Key features:
# - Node.js 20 runtime (matches Lambda environment)
# - Native 'unzip' for symlink preservation in npm packages
# - lambda-stream for SSE response streaming
# - AWS SDK v3 for S3 access
# ==============================================================================

FROM public.ecr.aws/lambda/nodejs:20

LABEL maintainer="MCPJungle Team"
LABEL description="Dynamic MCP tool adapter for AWS Lambda"
LABEL version="1.0.0"

WORKDIR /var/task

# ------------------------------------------------------------------------------
# Install System Dependencies
# ------------------------------------------------------------------------------
# We need native 'unzip' to preserve symlinks in npm packages.
# The 'unzip' command properly handles symlinks in .bin directories,
# which is critical for npm package binaries to work.

RUN dnf install -y unzip && \
    dnf clean all && \
    rm -rf /var/cache/dnf

# ------------------------------------------------------------------------------
# Install Node.js Dependencies
# ------------------------------------------------------------------------------
# - lambda-stream: Enables SSE streaming responses from Lambda
# - @aws-sdk/client-s3: AWS SDK v3 for downloading packages from S3

COPY package*.json ./

RUN npm install --omit=dev && \
    npm cache clean --force

# ------------------------------------------------------------------------------
# Copy Application Code
# ------------------------------------------------------------------------------

COPY src/index.js ./index.js

# ------------------------------------------------------------------------------
# Lambda Handler Configuration
# ------------------------------------------------------------------------------

CMD [ "index.handler" ]
