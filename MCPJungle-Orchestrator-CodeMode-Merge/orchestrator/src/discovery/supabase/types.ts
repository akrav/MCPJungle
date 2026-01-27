/**
 * Type definitions for Supabase database entities
 *
 * These interfaces mirror the existing Supabase `tools` table schema.
 * Note: We have read-only access to existing tables - we can SELECT but not INSERT/UPDATE/DELETE.
 *
 * @module discovery/supabase/types
 */

/**
 * Listing status enum for tools
 */
export type ListingStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Tool entity representing an MCP tool in the Supabase registry
 *
 * This interface mirrors the `public.tools` table in Supabase.
 */
export interface Tool {
  /** Unique identifier (UUID) */
  id: string;
  /** Timestamp when the tool was created */
  created_at: string;
  /** Reference to the merchant who provides this tool */
  merchant_id: string;
  /** Human-readable name of the tool */
  name: string;
  /** Description of what the tool does - used for vector search */
  description: string;
  /** URL endpoint to access/download this MCP tool */
  endpoint_url: string;
  /** Cost per API call in the platform's currency unit */
  price_per_call: number;
  /** Average user rating (0-5 scale) */
  average_rating: number;
  /** Timestamp when the tool was last updated */
  updated_at: string;
  /** Whether the tool is currently available for use */
  listing_status: ListingStatus;
}

/**
 * Minimal tool representation for search results and selection
 * Contains only the fields needed for discovery and filtering
 */
export interface ToolSummary {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  price_per_call: number;
  average_rating: number;
  listing_status: ListingStatus;
}

/**
 * Tool with similarity score from vector search
 */
export interface ToolWithScore extends ToolSummary {
  /** Cosine similarity score from vector search (0-1) */
  similarity: number;
}


// ==============================================================================
// Lambda Deployment Types
// ==============================================================================

/**
 * Deployment type for MCP tools
 * - PUBLIC: Shared Lambda function accessible by all users
 * - PRIVATE: Per-user Lambda function for isolation
 * - EXTERNAL: Tool runs on external infrastructure
 */
export type DeploymentType = 'PUBLIC' | 'PRIVATE' | 'EXTERNAL';

/**
 * Status of a user's Lambda instance
 */
export type LambdaInstanceStatus = 'CREATING' | 'ACTIVE' | 'UPDATING' | 'FAILED' | 'DELETED';

/**
 * Tool deployment configuration
 * Mirrors the `tool_deployments_orchestrator` table
 */
export interface ToolDeployment {
  /** Unique identifier (UUID) */
  id: string;
  /** Reference to the tool */
  tool_id: string;
  /** How the tool should be deployed */
  deployment_type: DeploymentType;
  /** S3 bucket for the tool package */
  s3_bucket: string | null;
  /** S3 key for the tool package */
  s3_package_key: string | null;
  /** Lambda runtime (e.g., 'nodejs20.x') */
  runtime: string;
  /** Lambda handler (e.g., 'index.handler') */
  handler: string;
  /** Lambda timeout in seconds */
  timeout_seconds: number;
  /** Lambda memory in MB */
  memory_mb: number;
  /** For PUBLIC deployment, the shared Lambda ARN */
  shared_lambda_arn: string | null;
  /** For PUBLIC deployment, the shared Lambda URL */
  shared_lambda_url: string | null;
  /** Package version */
  package_version: string;
  /** Package size in bytes */
  package_size_bytes: number | null;
  /** Package hash for integrity */
  package_hash: string | null;
  /** Timestamp when created */
  created_at: string;
  /** Timestamp when last updated */
  updated_at: string;
}

/**
 * User's Lambda instance for a specific tool
 * Mirrors the `user_lambda_instances_orchestrator` table
 */
export interface UserLambdaInstance {
  /** Unique identifier (UUID) */
  id: string;
  /** User who owns this Lambda instance */
  user_id: string;
  /** Reference to the tool */
  tool_id: string;
  /** Lambda function name */
  function_name: string;
  /** Lambda function ARN */
  function_arn: string;
  /** Lambda function URL (if enabled) */
  function_url: string | null;
  /** Current status of the Lambda instance */
  status: LambdaInstanceStatus;
  /** Error message if status is FAILED */
  error_message: string | null;
  /** Memory allocation in MB */
  memory_mb: number;
  /** Timeout in seconds */
  timeout_seconds: number;
  /** Current package version */
  package_version: string;
  /** Timestamp when created */
  created_at: string;
  /** Timestamp when last updated */
  updated_at: string;
  /** Timestamp of last invocation */
  last_invoked_at: string | null;
}

/**
 * Lambda invocation log entry
 * Mirrors the `lambda_invocation_logs_orchestrator` table
 */
export interface LambdaInvocationLog {
  /** Unique identifier (UUID) */
  id: string;
  /** Reference to the Lambda instance */
  lambda_instance_id: string;
  /** AWS request ID */
  request_id: string;
  /** MCP method called */
  method: 'tools/list' | 'tools/call' | 'initialize' | 'ping';
  /** Tool name if method was tools/call */
  tool_name: string | null;
  /** Execution duration in milliseconds */
  duration_ms: number | null;
  /** Billed duration in milliseconds */
  billed_duration_ms: number | null;
  /** Memory used in MB */
  memory_used_mb: number | null;
  /** Cold start initialization time in milliseconds */
  init_duration_ms: number | null;
  /** Whether this was a cold start */
  is_cold_start: boolean;
  /** Whether the invocation was successful */
  is_success: boolean;
  /** Error type if failed */
  error_type: string | null;
  /** Error message if failed */
  error_message: string | null;
  /** Timestamp of invocation */
  invoked_at: string;
}

/**
 * Summary view of a tool with its deployment information
 */
export interface ToolWithDeployment extends ToolSummary {
  /** Deployment configuration if available */
  deployment?: ToolDeployment;
}
