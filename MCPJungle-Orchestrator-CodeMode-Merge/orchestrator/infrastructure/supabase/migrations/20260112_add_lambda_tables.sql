-- Lambda Tool Support Tables for MCPJungle Orchestrator
-- Migration: 20260112_add_lambda_tables
-- Created: 2026-01-12
--
-- This migration adds tables required for Lambda-based MCP tool provisioning.
-- These tables extend the orchestrator's tool management capabilities to support:
-- 1. Tool deployment metadata (how tools should be deployed)
-- 2. Per-user Lambda instances (isolated Lambda functions per user/tool)

-- ==============================================================================
-- Table: tool_deployments_orchestrator
-- Purpose: Stores deployment configuration for MCP tools
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tool_deployments_orchestrator (
  -- Primary key
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to the tool in the main tools table
  tool_id          UUID NOT NULL,
  
  -- Deployment type determines how the tool is provisioned:
  -- PUBLIC: Shared Lambda function accessible by all users
  -- PRIVATE: Per-user Lambda function for isolation
  -- EXTERNAL: Tool runs on external infrastructure (endpoint_url in tools table)
  deployment_type  TEXT NOT NULL CHECK (deployment_type IN ('PUBLIC', 'PRIVATE', 'EXTERNAL')),
  
  -- S3 location for the tool package
  s3_bucket        TEXT,
  s3_package_key   TEXT,
  
  -- Lambda runtime configuration
  runtime          TEXT DEFAULT 'nodejs20.x',
  handler          TEXT DEFAULT 'index.handler',
  timeout_seconds  INT DEFAULT 30 CHECK (timeout_seconds > 0 AND timeout_seconds <= 900),
  memory_mb        INT DEFAULT 512 CHECK (memory_mb >= 128 AND memory_mb <= 10240),
  
  -- For PUBLIC deployment type, the shared Lambda ARN
  shared_lambda_arn TEXT,
  shared_lambda_url TEXT,
  
  -- Metadata
  package_version  TEXT DEFAULT 'latest',
  package_size_bytes BIGINT,
  package_hash     TEXT,
  
  -- Timestamps
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique deployment per tool
  UNIQUE (tool_id)
);

-- Index for quick lookups by tool_id
CREATE INDEX IF NOT EXISTS idx_tool_deployments_tool_id 
  ON tool_deployments_orchestrator(tool_id);

-- Index for filtering by deployment type
CREATE INDEX IF NOT EXISTS idx_tool_deployments_type 
  ON tool_deployments_orchestrator(deployment_type);

-- ==============================================================================
-- Table: user_lambda_instances_orchestrator
-- Purpose: Tracks per-user Lambda function instances
-- ==============================================================================

CREATE TABLE IF NOT EXISTS user_lambda_instances_orchestrator (
  -- Primary key
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User who owns this Lambda instance
  user_id         UUID NOT NULL,
  
  -- Reference to the tool
  tool_id         UUID NOT NULL,
  
  -- Lambda function identifiers
  function_name   TEXT NOT NULL,
  function_arn    TEXT NOT NULL,
  function_url    TEXT,
  
  -- Instance status
  -- CREATING: Lambda is being provisioned
  -- ACTIVE: Lambda is ready to receive invocations
  -- UPDATING: Lambda is being updated (new package version)
  -- FAILED: Lambda provisioning failed
  -- DELETED: Lambda has been deleted (soft delete)
  status          TEXT NOT NULL DEFAULT 'CREATING' 
    CHECK (status IN ('CREATING', 'ACTIVE', 'UPDATING', 'FAILED', 'DELETED')),
  
  -- Error details if status is FAILED
  error_message   TEXT,
  
  -- Resource tracking
  memory_mb       INT DEFAULT 512,
  timeout_seconds INT DEFAULT 30,
  package_version TEXT DEFAULT 'latest',
  
  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  last_invoked_at TIMESTAMPTZ,
  
  -- Ensure unique Lambda per user/tool combination
  UNIQUE (user_id, tool_id)
);

-- Index for looking up user's Lambda instances
CREATE INDEX IF NOT EXISTS idx_user_lambda_user_id 
  ON user_lambda_instances_orchestrator(user_id);

-- Index for looking up Lambda instances by tool
CREATE INDEX IF NOT EXISTS idx_user_lambda_tool_id 
  ON user_lambda_instances_orchestrator(tool_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_user_lambda_status 
  ON user_lambda_instances_orchestrator(status);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_user_lambda_user_tool_status 
  ON user_lambda_instances_orchestrator(user_id, tool_id, status);

-- ==============================================================================
-- Table: lambda_invocation_logs_orchestrator
-- Purpose: Tracks Lambda invocations for billing and analytics
-- ==============================================================================

CREATE TABLE IF NOT EXISTS lambda_invocation_logs_orchestrator (
  -- Primary key
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to the Lambda instance
  lambda_instance_id UUID NOT NULL,
  
  -- Invocation details
  request_id      TEXT NOT NULL,
  method          TEXT NOT NULL CHECK (method IN ('tools/list', 'tools/call', 'initialize', 'ping')),
  tool_name       TEXT,
  
  -- Performance metrics
  duration_ms     INT,
  billed_duration_ms INT,
  memory_used_mb  INT,
  init_duration_ms INT,  -- Cold start duration, NULL if warm
  
  -- Status
  is_cold_start   BOOLEAN DEFAULT FALSE,
  is_success      BOOLEAN DEFAULT TRUE,
  error_type      TEXT,
  error_message   TEXT,
  
  -- Timestamp
  invoked_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by lambda instance
CREATE INDEX IF NOT EXISTS idx_lambda_logs_instance 
  ON lambda_invocation_logs_orchestrator(lambda_instance_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_lambda_logs_time 
  ON lambda_invocation_logs_orchestrator(invoked_at DESC);

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_lambda_logs_analytics 
  ON lambda_invocation_logs_orchestrator(lambda_instance_id, invoked_at DESC);

-- ==============================================================================
-- Functions
-- ==============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tool_deployments_orchestrator
DROP TRIGGER IF EXISTS set_updated_at_tool_deployments ON tool_deployments_orchestrator;
CREATE TRIGGER set_updated_at_tool_deployments
  BEFORE UPDATE ON tool_deployments_orchestrator
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_lambda_instances_orchestrator
DROP TRIGGER IF EXISTS set_updated_at_user_lambda ON user_lambda_instances_orchestrator;
CREATE TRIGGER set_updated_at_user_lambda
  BEFORE UPDATE ON user_lambda_instances_orchestrator
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on tables
ALTER TABLE tool_deployments_orchestrator ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lambda_instances_orchestrator ENABLE ROW LEVEL SECURITY;
ALTER TABLE lambda_invocation_logs_orchestrator ENABLE ROW LEVEL SECURITY;

-- Policies for tool_deployments_orchestrator
-- Read-only access for authenticated users
CREATE POLICY tool_deployments_select_policy ON tool_deployments_orchestrator
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policies for user_lambda_instances_orchestrator
-- Users can only see their own Lambda instances
CREATE POLICY user_lambda_select_policy ON user_lambda_instances_orchestrator
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_lambda_insert_policy ON user_lambda_instances_orchestrator
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_lambda_update_policy ON user_lambda_instances_orchestrator
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for lambda_invocation_logs_orchestrator
-- Users can only see logs for their own Lambda instances
CREATE POLICY lambda_logs_select_policy ON lambda_invocation_logs_orchestrator
  FOR SELECT
  USING (
    lambda_instance_id IN (
      SELECT id FROM user_lambda_instances_orchestrator 
      WHERE user_id = auth.uid()
    )
  );

-- ==============================================================================
-- Comments
-- ==============================================================================

COMMENT ON TABLE tool_deployments_orchestrator IS 
  'Stores deployment configuration for MCP tools (Lambda settings, S3 locations)';

COMMENT ON TABLE user_lambda_instances_orchestrator IS 
  'Tracks per-user Lambda function instances for isolated tool execution';

COMMENT ON TABLE lambda_invocation_logs_orchestrator IS 
  'Logs Lambda invocations for billing, analytics, and debugging';

COMMENT ON COLUMN tool_deployments_orchestrator.deployment_type IS 
  'PUBLIC=shared Lambda, PRIVATE=per-user Lambda, EXTERNAL=external endpoint';

COMMENT ON COLUMN user_lambda_instances_orchestrator.status IS 
  'CREATING, ACTIVE, UPDATING, FAILED, or DELETED';
