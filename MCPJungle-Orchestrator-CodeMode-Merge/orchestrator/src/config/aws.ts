/**
 * AWS Lambda Configuration Types and Utilities
 *
 * Provides typed configuration interfaces and loading functions for
 * AWS Lambda integration in the MCPJungle orchestrator.
 *
 * @module config/aws
 */

import { loadConfig } from './load.js';

/**
 * Configuration for Lambda function deployment and execution
 */
export interface LambdaConfig {
  /** AWS region (e.g., 'us-east-1') */
  region: string;

  /** Public HTTPS URL for the Lambda function */
  functionUrl?: string;

  /** S3 bucket for MCP tool packages */
  s3Bucket?: string;

  /** IAM role ARN for Lambda execution */
  roleArn?: string;

  /** ECR repository URL for Lambda container images */
  ecrRepo?: string;

  /** Memory allocation in MB (128-10240) */
  memoryMb: number;

  /** Execution timeout in milliseconds */
  timeoutMs: number;

  /** Ephemeral storage (/tmp) size in MB (512-10240) */
  ephemeralStorageMb: number;
}

/**
 * Configuration for S3 package storage
 */
export interface S3Config {
  /** S3 bucket name */
  bucket: string;

  /** AWS region */
  region: string;

  /** Prefix for package keys (default: 'packages/') */
  packagePrefix: string;
}

/**
 * Full AWS configuration combining Lambda and S3
 */
export interface AwsConfig {
  lambda: LambdaConfig;
  s3: S3Config | null;
}

/**
 * Checks if Lambda configuration is complete and valid
 *
 * @param config - Lambda configuration to validate
 * @returns true if the configuration has all required fields
 */
export function isLambdaConfigValid(config: LambdaConfig): boolean {
  return !!(
    config.region &&
    config.functionUrl &&
    config.s3Bucket
  );
}

/**
 * Checks if Lambda provisioning is enabled
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns true if provisioner is set to 'lambda'
 */
export function isLambdaProvisioningEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const cfg = loadConfig(env);
  return cfg.provisioner === 'lambda';
}

/**
 * Loads Lambda configuration from environment variables
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns Lambda configuration object
 */
export function loadLambdaConfig(
  env: NodeJS.ProcessEnv = process.env
): LambdaConfig {
  const cfg = loadConfig(env);

  return {
    region: cfg.awsRegion,
    functionUrl: cfg.awsLambdaFunctionUrl,
    s3Bucket: cfg.awsLambdaS3Bucket,
    roleArn: cfg.awsLambdaRoleArn,
    ecrRepo: cfg.awsLambdaEcrRepo,
    memoryMb: cfg.lambdaMemoryMb,
    timeoutMs: cfg.lambdaTimeoutMs,
    ephemeralStorageMb: cfg.lambdaEphemeralStorageMb,
  };
}

/**
 * Loads S3 configuration from environment variables
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns S3 configuration object or null if not configured
 */
export function loadS3Config(
  env: NodeJS.ProcessEnv = process.env
): S3Config | null {
  const cfg = loadConfig(env);

  if (!cfg.awsLambdaS3Bucket) {
    return null;
  }

  return {
    bucket: cfg.awsLambdaS3Bucket,
    region: cfg.awsRegion,
    packagePrefix: 'packages/',
  };
}

/**
 * Loads full AWS configuration from environment variables
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns Full AWS configuration object
 */
export function loadAwsConfig(
  env: NodeJS.ProcessEnv = process.env
): AwsConfig {
  return {
    lambda: loadLambdaConfig(env),
    s3: loadS3Config(env),
  };
}

/**
 * Builds the Lambda function URL with tool query parameters
 *
 * @param baseUrl - Base Lambda function URL
 * @param toolName - Name of the MCP tool
 * @param version - Version of the tool (default: 'latest')
 * @returns Complete URL with query parameters
 */
export function buildLambdaToolUrl(
  baseUrl: string,
  toolName: string,
  version: string = 'latest'
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('tool', toolName);
  url.searchParams.set('version', version);
  return url.toString();
}

/**
 * Parses tool name and version from a Lambda URL
 *
 * @param url - Lambda function URL with query parameters
 * @returns Object with toolName and version, or null if not found
 */
export function parseLambdaToolUrl(
  url: string
): { toolName: string; version: string } | null {
  try {
    const parsed = new URL(url);
    const toolName = parsed.searchParams.get('tool');
    const version = parsed.searchParams.get('version') || 'latest';

    if (!toolName) {
      return null;
    }

    return { toolName, version };
  } catch {
    return null;
  }
}

/**
 * Builds the S3 key for a tool package
 *
 * @param toolName - Name of the MCP tool
 * @param version - Version of the tool
 * @param prefix - Key prefix (default: 'packages/')
 * @returns S3 object key
 */
export function buildS3PackageKey(
  toolName: string,
  version: string = 'latest',
  prefix: string = 'packages/'
): string {
  return `${prefix}${toolName}/${version}.zip`;
}
