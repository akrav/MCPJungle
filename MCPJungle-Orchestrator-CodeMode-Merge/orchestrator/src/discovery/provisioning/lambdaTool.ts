/**
 * Lambda Tool Provisioner
 *
 * Handles provisioning individual MCP tools to run on AWS Lambda.
 * This module manages tool-specific Lambda configurations, S3 package
 * verification, and URL generation for Lambda-backed tools.
 *
 * @module discovery/provisioning/lambdaTool
 */

import {
  loadLambdaConfig,
  loadS3Config,
  buildLambdaToolUrl,
  buildS3PackageKey,
  isLambdaConfigValid,
  type LambdaConfig,
  type S3Config,
} from '../../config/aws.js';
import { log } from '../../obs/log.js';
import type { InstallableTool } from './installer.js';

// ==============================================================================
// Types
// ==============================================================================

/**
 * Result of a Lambda tool provisioning operation
 */
export interface LambdaToolProvisionResult {
  /** Whether provisioning was successful */
  success: boolean;

  /** Tool ID */
  toolId: string;

  /** Lambda function URL with tool parameters */
  lambdaUrl: string;

  /** S3 key where the tool package is stored */
  s3Key: string;

  /** Whether the package was verified in S3 */
  packageVerified: boolean;

  /** Error message if provisioning failed */
  error?: string;
}

/**
 * Configuration for a Lambda-backed tool
 */
export interface LambdaToolConfig {
  /** Tool ID */
  toolId: string;

  /** Tool name (used as S3 package key prefix) */
  toolName: string;

  /** Package version */
  version: string;

  /** Lambda function URL */
  functionUrl: string;

  /** S3 bucket for packages */
  s3Bucket: string;

  /** S3 key for the package */
  s3Key: string;

  /** Timestamp when provisioned */
  provisionedAt: string;
}

/**
 * Error thrown when Lambda tool provisioning fails
 */
export class LambdaToolProvisionError extends Error {
  constructor(
    message: string,
    public readonly toolId: string,
    public readonly phase: 'config' | 's3' | 'lambda' | 'validation',
    public readonly originalError?: Error
  ) {
    super(`LambdaToolProvisionError [${phase}]: ${message}`);
    this.name = 'LambdaToolProvisionError';
  }
}

// ==============================================================================
// In-Memory Cache
// ==============================================================================

/**
 * Cache of provisioned Lambda tools
 * Key: `${userId}:${toolId}`
 */
const provisionedToolsCache = new Map<string, LambdaToolConfig>();

/**
 * Generates a cache key for a user's tool
 */
function getCacheKey(userId: string, toolId: string): string {
  return `${userId}:${toolId}`;
}

// ==============================================================================
// S3 Package Verification
// ==============================================================================

/**
 * Verifies that a tool package exists in S3
 *
 * This is a lightweight check that doesn't download the package.
 * The actual download happens in the Lambda function on cold start.
 *
 * @param s3Config - S3 configuration
 * @param toolName - Name of the tool
 * @param version - Version of the tool
 * @returns true if the package exists
 */
export async function verifyS3Package(
  s3Config: S3Config,
  toolName: string,
  version: string = 'latest'
): Promise<boolean> {
  const s3Key = buildS3PackageKey(toolName, version, s3Config.packagePrefix);

  log('info', 'lambda_tool_verify_s3_start', {
    bucket: s3Config.bucket,
    key: s3Key,
    toolName,
    version,
  });

  try {
    // Dynamically import S3 client to avoid bundling issues
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({ region: s3Config.region });
    const command = new HeadObjectCommand({
      Bucket: s3Config.bucket,
      Key: s3Key,
    });

    await client.send(command);

    log('info', 'lambda_tool_verify_s3_success', {
      bucket: s3Config.bucket,
      key: s3Key,
    });

    return true;
  } catch (err) {
    const error = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } };

    // 404 means package doesn't exist
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      log('warn', 'lambda_tool_verify_s3_not_found', {
        bucket: s3Config.bucket,
        key: s3Key,
        toolName,
        version,
      });
      return false;
    }

    // Other errors (permissions, network, etc.)
    log('error', 'lambda_tool_verify_s3_error', {
      bucket: s3Config.bucket,
      key: s3Key,
      error: error.message,
    });

    throw new LambdaToolProvisionError(
      `Failed to verify S3 package: ${error.message}`,
      toolName,
      's3',
      error
    );
  }
}

// ==============================================================================
// Main Provisioning Functions
// ==============================================================================

/**
 * Provisions a tool for Lambda execution
 *
 * This function:
 * 1. Validates Lambda configuration
 * 2. Optionally verifies the package exists in S3
 * 3. Generates the Lambda URL with tool parameters
 * 4. Caches the configuration for future use
 *
 * @param userId - User ID requesting the tool
 * @param tool - Tool to provision
 * @param options - Provisioning options
 * @returns Provisioning result
 */
export async function provisionToolLambda(
  userId: string,
  tool: InstallableTool,
  options: {
    /** Version to provision (default: 'latest') */
    version?: string;
    /** Skip S3 package verification (default: false) */
    skipVerification?: boolean;
    /** Custom Lambda config (default: from env vars) */
    lambdaConfig?: LambdaConfig;
    /** Custom S3 config (default: from env vars) */
    s3Config?: S3Config | null;
  } = {}
): Promise<LambdaToolProvisionResult> {
  const version = options.version ?? 'latest';
  const skipVerification = options.skipVerification ?? false;

  log('info', 'lambda_tool_provision_start', {
    userId,
    toolId: tool.id,
    toolName: tool.name,
    version,
  });

  // 1. Load and validate configuration
  const lambdaConfig = options.lambdaConfig ?? loadLambdaConfig();
  const s3Config = options.s3Config !== undefined ? options.s3Config : loadS3Config();

  if (!isLambdaConfigValid(lambdaConfig)) {
    log('error', 'lambda_tool_provision_invalid_config', {
      toolId: tool.id,
      hasRegion: !!lambdaConfig.region,
      hasFunctionUrl: !!lambdaConfig.functionUrl,
      hasS3Bucket: !!lambdaConfig.s3Bucket,
    });

    throw new LambdaToolProvisionError(
      'Lambda configuration is incomplete. Ensure AWS_REGION, AWS_LAMBDA_FUNCTION_URL, and AWS_LAMBDA_S3_BUCKET are set.',
      tool.id,
      'config'
    );
  }

  // 2. Build S3 key and Lambda URL
  const toolName = sanitizeToolName(tool.name);
  const s3Key = buildS3PackageKey(toolName, version, s3Config?.packagePrefix ?? 'packages/');
  const lambdaUrl = buildLambdaToolUrl(lambdaConfig.functionUrl!, toolName, version);

  // 3. Verify S3 package exists (optional)
  let packageVerified = false;
  if (!skipVerification && s3Config) {
    try {
      packageVerified = await verifyS3Package(s3Config, toolName, version);

      if (!packageVerified) {
        log('warn', 'lambda_tool_provision_package_missing', {
          userId,
          toolId: tool.id,
          toolName,
          version,
          s3Key,
        });

        return {
          success: false,
          toolId: tool.id,
          lambdaUrl,
          s3Key,
          packageVerified: false,
          error: `Tool package not found in S3: ${s3Key}`,
        };
      }
    } catch (err) {
      if (err instanceof LambdaToolProvisionError) {
        return {
          success: false,
          toolId: tool.id,
          lambdaUrl,
          s3Key,
          packageVerified: false,
          error: err.message,
        };
      }
      throw err;
    }
  }

  // 4. Cache the configuration
  const toolConfig: LambdaToolConfig = {
    toolId: tool.id,
    toolName,
    version,
    functionUrl: lambdaConfig.functionUrl!,
    s3Bucket: lambdaConfig.s3Bucket!,
    s3Key,
    provisionedAt: new Date().toISOString(),
  };

  provisionedToolsCache.set(getCacheKey(userId, tool.id), toolConfig);

  log('info', 'lambda_tool_provision_success', {
    userId,
    toolId: tool.id,
    toolName,
    version,
    lambdaUrl,
    s3Key,
    packageVerified,
  });

  return {
    success: true,
    toolId: tool.id,
    lambdaUrl,
    s3Key,
    packageVerified,
  };
}

/**
 * Gets a provisioned Lambda tool configuration from cache
 *
 * @param userId - User ID
 * @param toolId - Tool ID
 * @returns Cached configuration or null
 */
export function getProvisionedTool(
  userId: string,
  toolId: string
): LambdaToolConfig | null {
  return provisionedToolsCache.get(getCacheKey(userId, toolId)) ?? null;
}

/**
 * Gets all provisioned Lambda tools for a user
 *
 * @param userId - User ID
 * @returns Array of provisioned tool configurations
 */
export function getUserProvisionedTools(userId: string): LambdaToolConfig[] {
  const tools: LambdaToolConfig[] = [];
  const prefix = `${userId}:`;

  provisionedToolsCache.forEach((config, key) => {
    if (key.startsWith(prefix)) {
      tools.push(config);
    }
  });

  return tools;
}

/**
 * Removes a provisioned tool from cache
 *
 * @param userId - User ID
 * @param toolId - Tool ID
 * @returns true if the tool was removed
 */
export function deprovisionToolLambda(
  userId: string,
  toolId: string
): boolean {
  const key = getCacheKey(userId, toolId);
  const existed = provisionedToolsCache.has(key);

  if (existed) {
    provisionedToolsCache.delete(key);
    log('info', 'lambda_tool_deprovision', { userId, toolId });
  }

  return existed;
}

/**
 * Clears all provisioned tools from cache
 * Useful for testing or cleanup
 */
export function clearProvisionedToolsCache(): void {
  provisionedToolsCache.clear();
  log('info', 'lambda_tool_cache_cleared');
}

// ==============================================================================
// Utility Functions
// ==============================================================================

/**
 * Sanitizes a tool name for use in S3 keys and Lambda parameters
 *
 * @param name - Original tool name
 * @returns Sanitized name (lowercase, alphanumeric with hyphens)
 */
export function sanitizeToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Checks if a tool can be provisioned on Lambda
 *
 * @param tool - Tool to check
 * @returns true if the tool can be provisioned
 */
export function isLambdaCompatible(tool: InstallableTool): boolean {
  // For now, all tools are considered Lambda-compatible
  // Future: check tool metadata for Lambda support
  return tool.id !== undefined && tool.name !== undefined;
}

/**
 * Gets the Lambda configuration status
 *
 * @returns Object describing Lambda configuration state
 */
export function getLambdaConfigStatus(): {
  configured: boolean;
  hasRegion: boolean;
  hasFunctionUrl: boolean;
  hasS3Bucket: boolean;
  hasRoleArn: boolean;
} {
  const config = loadLambdaConfig();

  return {
    configured: isLambdaConfigValid(config),
    hasRegion: !!config.region,
    hasFunctionUrl: !!config.functionUrl,
    hasS3Bucket: !!config.s3Bucket,
    hasRoleArn: !!config.roleArn,
  };
}
